// src/pages/Admin/AdminFacilitiesPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

// Импортируем API функции и компоненты
import apiClient, { fetchFacilities, fetchFacilityDetail } from '../../services/api'; // Добавили fetchFacilityDetail
import LoadingSpinner from '../../components/Common/LoadingSpinner.jsx';
import Pagination from '../../components/Common/Pagination.jsx';
import FacilityEditModal from '../../components/Admin/FacilityEditModal.jsx';

const AdminFacilitiesPage = () => {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    // Состояния для модального окна
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFacility, setEditingFacility] = useState(null); // null = новый, объект = редактирование
    const [isLoadingDetail, setIsLoadingDetail] = useState(false); // Флаг загрузки деталей для редактирования

    // --- Запрос списка объектов ---
    const queryParams = { page };
    const {
        data: facilitiesData,
        isLoading: isLoadingList, // Переименовали для ясности
        isError: isListError,
        error: listError,
        isFetching: isFetchingList
    } = useQuery({
        queryKey: ['adminFacilities', queryParams],
        queryFn: () => fetchFacilities({ queryKey: ['adminFacilities', queryParams] }),
        keepPreviousData: true,
    });

    // --- Мутация для создания/обновления ---
    const saveFacilityMutation = useMutation({
        mutationFn: (facilityInput) => {
            const { id, ...data } = facilityInput;
            // Убираем amenity_ids если бэк его не ожидает в PATCH/POST Facility,
            // или оставляем, если PrimaryKeyRelatedField настроен для записи.
            // В нашем FacilityDetailSerializer он настроен для записи через amenity_ids.
            // delete data.amenities; // Удаляем массив объектов amenities перед отправкой
            // delete data.images;    // Удаляем массив объектов images
            // delete data.facility_type_display; // Удаляем поле только для чтения

            if (id) {
                console.log("PATCHING Facility:", id, data);
                return apiClient.patch(`/catalog/facilities/${id}/`, data);
            } else {
                console.log("POSTING Facility:", data);
                return apiClient.post(`/catalog/facilities/`, data);
            }
        },
        onSuccess: (data, variables) => {
            console.log("Save success:", data);
            queryClient.invalidateQueries({ queryKey: ['adminFacilities'] }); // Обновляем список
            if (variables.id) {
                 queryClient.invalidateQueries({ queryKey: ['facilityDetail', variables.id] }); // И детали
            }
            handleCloseModal();
            alert(variables.id ? "Объект успешно обновлен!" : "Объект успешно добавлен!");
        },
        onError: (error, variables) => {
            console.error("Save facility error:", error.response?.data || error);
            const errorMsg = error.response?.data?.detail
                           || (typeof error.response?.data === 'object' ? JSON.stringify(error.response.data) : error.message)
                           || 'Произошла ошибка';
            alert(`Ошибка сохранения: ${errorMsg}`);
            // TODO: Передать ошибки в модальное окно
        }
    });

     // --- Мутация для удаления ---
      const deleteFacilityMutation = useMutation({
        mutationFn: (facilityId) => apiClient.delete(`/catalog/facilities/${facilityId}/`),
        onSuccess: (data, facilityId) => {
             console.log("Delete success for ID:", facilityId);
             queryClient.invalidateQueries({ queryKey: ['adminFacilities'] });
             alert("Объект успешно удален!");
        },
        onError: (error, facilityId) => {
             console.error(`Delete facility error for ID ${facilityId}:`, error.response?.data || error);
             alert(`Ошибка удаления: ${error.response?.data?.detail || error.message}`);
        }
    });


    // --- Обработчики ---
    const handlePageChange = (newPage) => { setPage(newPage); };

    const handleAddFacility = () => {
        setEditingFacility(null); // Новый объект
        setIsLoadingDetail(false); // Не грузим детали
        setIsModalOpen(true);
    };

    // Загрузка деталей перед открытием окна редактирования
    const handleEditFacility = async (facilityListItem) => {
        console.log("Editing Facility (List Data):", facilityListItem);
        setIsModalOpen(true);     // Открываем модалку (она покажет спиннер)
        setIsLoadingDetail(true); // Включаем флаг загрузки деталей
        setEditingFacility(null); // Очищаем предыдущие данные на всякий случай
        try {
            const queryKey = ['facilityDetail', facilityListItem.id];
            // Используем fetchQuery для получения данных (из кэша или с сервера)
            const fullFacilityData = await queryClient.fetchQuery({
                 queryKey: queryKey,
                 queryFn: () => fetchFacilityDetail({ queryKey: queryKey }),
                 staleTime: 15 * 1000 // Кэшируем ненадолго для редактирования
             });
            console.log("Fetched Full Facility Data for Edit:", fullFacilityData);
            setEditingFacility(fullFacilityData); // Устанавливаем полные данные
        } catch (err) {
            console.error("Failed to fetch facility details for editing:", err);
            alert("Не удалось загрузить данные объекта для редактирования.");
            setIsModalOpen(false); // Закрываем модалку при ошибке
        } finally {
            setIsLoadingDetail(false); // Выключаем флаг загрузки деталей
        }
    };

    const handleDeleteFacility = (facilityId, facilityName) => {
        if (window.confirm(`Вы уверены, что хотите удалить объект "${facilityName}" (ID: ${facilityId})?`)) {
            deleteFacilityMutation.mutate(facilityId);
        }
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingFacility(null);
    };

    // Вызывается из модального окна
    const handleSaveFacility = (formDataFromModal) => {
        saveFacilityMutation.mutate({ id: editingFacility?.id, ...formDataFromModal });
    };


    // --- Стили ---
     const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' };
     const titleStyle = { fontSize: '1.5rem', fontWeight: 600, margin: 0 };
     const buttonStyle = { padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#1a73e8', color: 'white', textDecoration: 'none' };
     const tableContainerStyle = { backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' };
     const tableWrapperStyle = { overflowX: 'auto' };
     const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: '800px' };
     const thStyle = { textAlign: 'left', padding: '1rem', backgroundColor: '#f8f9fa', color: '#202124', fontWeight: 600, fontSize: '0.875rem', borderBottom: '1px solid #e8eaed', whiteSpace: 'nowrap' };
     const tdStyle = { padding: '0.75rem 1rem', borderBottom: '1px solid #e8eaed', fontSize: '0.9rem', verticalAlign: 'middle' };
     const imageCellStyle = { width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px', backgroundColor: '#eee', display:'block'};
     const actionsCellStyle = { textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '1.5rem' };
     const actionButtonStyle = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', margin: '0 0.25rem', fontSize: '1rem', verticalAlign: 'middle', lineHeight: 1 };
     const editButtonStyle = { ...actionButtonStyle, color: '#1a73e8' }; // var(--primary)
     const deleteButtonStyle = { ...actionButtonStyle, color: '#dc3545' }; // var(--danger)
     const viewButtonStyle = { ...actionButtonStyle, color: '#0d6efd', textDecoration: 'none' }; // Синий для просмотра
     const statusBadgeStyle = (isActive) => ({
        display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '50px',
        fontSize: '0.75rem', fontWeight: 600,
        backgroundColor: isActive ? 'rgba(52, 168, 83, 0.1)' : 'rgba(234, 67, 53, 0.1)',
        color: isActive ? '#34a853' : '#ea4335', // success/danger
     });
     const paginationContainerStyle = {marginTop: '1.5rem', display: 'flex', justifyContent: 'center'};
     const loadingRowStyle = { textAlign: 'center', padding: '2rem', color: '#5f6368' };
     const errorRowStyle = { textAlign: 'center', padding: '2rem', color: 'red' };
     const noDataRowStyle = { textAlign: 'center', padding: '2rem', color: '#5f6368' };

    // --- Данные для пагинации ---
    const facilitiesList = facilitiesData?.results || [];
    const totalFacilities = facilitiesData?.count ?? 0;
    const pageSize = facilitiesList.length || (facilitiesData?.results?.length > 0 ? facilitiesData.results.length : 10);
    const totalPages = Math.ceil(totalFacilities / pageSize);

    // Определяем, идет ли загрузка списка или деталей (для общего спиннера или блокировки)
    const isCurrentlyLoading = isLoadingList || (isFetchingList && !facilitiesData); // Показываем спиннер только при первой загрузке или если нет данных во время fetch

    return (
        <div>
            <div style={headerStyle}>
                <h1 style={titleStyle}>Управление Спортивными Объектами</h1>
                 <button style={buttonStyle} onClick={handleAddFacility}>
                     <i className="fas fa-plus" style={{ marginRight: '5px' }}></i>
                    Добавить объект
                </button>
            </div>

            {/* TODO: Добавить поиск и фильтры для админки */}

            <div style={tableContainerStyle}>
                <div style={tableWrapperStyle}>
                    <table style={tableStyle}>
                        <thead>
                            <tr>
                                <th style={thStyle}>ID</th>
                                <th style={thStyle}>Фото</th>
                                <th style={thStyle}>Название</th>
                                <th style={thStyle}>Тип</th>
                                <th style={thStyle}>Цена/час (сум)</th>
                                <th style={thStyle}>Статус</th>
                                <th style={thStyle}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isCurrentlyLoading && (
                                <tr><td colSpan="7" style={loadingRowStyle}><LoadingSpinner /></td></tr>
                            )}
                            {isListError && !isCurrentlyLoading && ( // Показываем ошибку только если не грузится
                                <tr><td colSpan="7" style={errorRowStyle}>Ошибка загрузки: {listError.message}</td></tr>
                            )}
                            {!isCurrentlyLoading && !isListError && facilitiesList.length === 0 && (
                                <tr><td colSpan="7" style={noDataRowStyle}>Объекты не найдены.</td></tr>
                            )}
                            {!isCurrentlyLoading && !isListError && facilitiesList.map(facility => (
                                <tr key={facility.id}>
                                    <td style={tdStyle}>#{facility.id}</td>
                                    <td style={tdStyle}>
                                        <img
                                            src={facility.main_image || 'https://via.placeholder.com/50x50.png?text=N/A'}
                                            alt={facility.name}
                                            style={imageCellStyle}
                                            onError={(e) => { e.target.onerror = null; e.target.src='https://via.placeholder.com/50x50.png?text=Err'; }}
                                        />
                                    </td>
                                    <td style={tdStyle}>{facility.name}</td>
                                    <td style={tdStyle}>{facility.facility_type_display || facility.facility_type}</td>
                                    <td style={{...tdStyle, whiteSpace: 'nowrap'}}>{parseInt(facility.price_per_hour || 0).toLocaleString()} сум</td>
                                    <td style={tdStyle}>
                                        <span style={statusBadgeStyle(facility.is_active)}>
                                            {facility.is_active ? 'Активен' : 'Неактивен'}
                                        </span>
                                    </td>
                                    <td style={actionsCellStyle}>
                                         <button style={editButtonStyle} title="Редактировать" onClick={() => handleEditFacility(facility)}>
                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="1em" height="1em"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                         </button>
                                         <button
                                            style={deleteButtonStyle}
                                            title="Удалить"
                                            onClick={() => handleDeleteFacility(facility.id, facility.name)}
                                            disabled={deleteFacilityMutation.isLoading && deleteFacilityMutation.variables === facility.id}
                                        >
                                             {deleteFacilityMutation.isLoading && deleteFacilityMutation.variables === facility.id
                                                ? <i className="fas fa-spinner fa-spin"></i>
                                                : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="1em" height="1em"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                             }
                                         </button>
                                         <Link to={`/facilities/${facility.id}`} target="_blank" style={viewButtonStyle} title="Просмотреть на сайте">
                                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="1em" height="1em"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
                                         </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>

             {/* Пагинация */}
             {!isCurrentlyLoading && totalFacilities > pageSize && totalPages > 1 && (
                <div style={paginationContainerStyle}>
                     <Pagination
                        currentPage={page}
                        totalCount={totalFacilities}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                    />
                </div>
             )}

            {/* Модальное окно (рендерится всегда, управляется isOpen) */}
            <FacilityEditModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSave={handleSaveFacility}
                facilityData={editingFacility}
                // Передаем оба состояния загрузки в модалку
                isLoading={isLoadingDetail || saveFacilityMutation.isLoading}
            />
        </div>
    );
};

export default AdminFacilitiesPage;