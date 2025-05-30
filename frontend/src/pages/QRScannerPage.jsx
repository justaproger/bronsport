// --- START OF FULL MODIFIED frontend/src/pages/QRScannerPage.jsx ---
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Link здесь не используется напрямую
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

import { fetchOrderDetailsByQRCode, completeOrderFromQR } from '../services/api';
import LoadingSpinner from '../components/Common/LoadingSpinner';
// BookingQRCode не используется для отображения на этой странице
// import { DOW_MAP_I18N, DOW_FALLBACK } from '../utils/helpers'; // Не нужны здесь
import { parseApiError } from '../utils/errorUtils';
import styles from './QRScannerPage.module.css';

const logger = {
    info: (...args) => console.log('[QRScanner]', ...args),
    warn: (...args) => console.warn('[QRScanner]', ...args),
    error: (...args) => console.error('[QRScanner]', ...args),
};

const QRScannerPage = () => {
    const { t, i18n } = useTranslation();
    const currentLang = i18n.language;
    const queryClient = useQueryClient(); // queryClient может понадобиться для инвалидации других запросов
    const navigate = useNavigate();
    const location = useLocation();

    const { user, isAuthenticated, isLoading: isLoadingAuth } = useSelector(state => state.auth);

    const [manualOrderCode, setManualOrderCode] = useState('');
    const [orderDetails, setOrderDetails] = useState(null);
    const [isLoadingApi, setIsLoadingApi] = useState(false); // Для индикации загрузки деталей заказа
    const [apiError, setApiError] = useState('');      // Ошибки от нашего API (fetchOrder, completeOrder)
    const [scanError, setScanError] = useState('');    // Ошибки от самого сканера (камера, разрешения)
    
    const [shouldBeScanning, setShouldBeScanning] = useState(false);
    const [isScannerUIVisible, setIsScannerUIVisible] = useState(false);
    const [isProcessingScan, setIsProcessingScan] = useState(false); // Флаг, что идет обработка уже отсканированного кода

    const html5QrCodeInstanceRef = useRef(null); // Для хранения инстанса Html5Qrcode
    const qrReaderElementId = "bronsport-qr-reader-element"; // Убедимся, что ID уникален

    const langPath = useCallback((path) => `/${currentLang}${path.startsWith('/') ? '' : '/'}${path}`, [currentLang]);

    
    // Мутация для получения деталей заказа
    const fetchOrderMutation = useMutation({
        mutationFn: (orderCode) => fetchOrderDetailsByQRCode({ queryKey: ['orderDetailsByQRCode', orderCode] }),
        onSuccess: (data) => { // data здесь это уже response.data из axios
            setOrderDetails(data);
            setApiError('');
            toast.success(t('qr_scanner.success.order_found'));
        },
        onError: (error) => {
            const parsedError = parseApiError(error);
            setApiError(parsedError);
            setOrderDetails(null);
            toast.error(`${t('qr_scanner.error.fetch_failed')} ${parsedError}`);
        },
        onSettled: () => {
            setIsLoadingApi(false);
            setIsProcessingScan(false); 
        }
    });

    // Мутация для завершения заказа
    const completeOrderMutation = useMutation({
        mutationFn: (code) => completeOrderFromQR(code),
        onSuccess: (response) => { // response здесь это { data: updatedOrderData } от axios
            toast.success(t('qr_scanner.success.order_completed'));
            setOrderDetails(response.data); 
        },
        onError: (error) => {
            const parsedError = parseApiError(error);
            toast.error(`${t('qr_scanner.error.complete_failed')} ${parsedError}`);
            setApiError(parsedError); // Показываем ошибку на странице
        }
    });

    const cleanupScanner = useCallback(async (stopScanningIntent = true) => {
        if (html5QrCodeInstanceRef.current) {
            try {
                const scannerState = html5QrCodeInstanceRef.current.getState();
                if (scannerState === 2 /* Html5Qrcode.SCANNING */ || scannerState === 1 /* Html5Qrcode.PAUSED */) {
                    logger.info("[QRScanner] Attempting to stop scanner via cleanupScanner...");
                    await html5QrCodeInstanceRef.current.stop();
                    logger.info("[QRScanner] Scanner stopped successfully by cleanupScanner.");
                }
            } catch (err) {
                logger.warn("[QRScanner] Error during scanner.stop() in cleanupScanner (might be already stopped or not started):", err.message);
            }
            // Очистка DOM элемента, если Html5Qrcode его модифицировал
            const readerElement = document.getElementById(qrReaderElementId);
            if (readerElement) {
                readerElement.innerHTML = ''; // Простой способ очистить содержимое
            }
            html5QrCodeInstanceRef.current = null;
        }
        setIsScannerUIVisible(false);
        if (stopScanningIntent) {
            setShouldBeScanning(false);
        }
    }, [qrReaderElementId]);


    const onScanSuccess = useCallback(async (decodedText, decodedResult) => {
        if (isProcessingScan) return; // Не обрабатываем, если уже идет обработка
        logger.info(`[QRScanner] Code matched: ${decodedText}`);
        
        setIsProcessingScan(true);    // Устанавливаем флаг, что мы начали обработку
        setShouldBeScanning(false);   // Говорим, что намерение сканировать пока пропало
        await cleanupScanner(false);  // Останавливаем и скрываем сканер, но не меняем shouldBeScanning глобально

        setManualOrderCode(decodedText); // Показываем код в поле ввода
        setOrderDetails(null);           // Сбрасываем предыдущие детали
        setApiError('');                 // Сбрасываем предыдущие ошибки API
        setIsLoadingApi(true);           // Показываем индикатор загрузки API
        fetchOrderMutation.mutate(decodedText); // Запрашиваем детали заказа
    }, [cleanupScanner, fetchOrderMutation, isProcessingScan]);

    const onScanFailure = useCallback((errorMessage) => {
        if (errorMessage && !String(errorMessage).toLowerCase().includes("qr code not found") && 
            !String(errorMessage).toLowerCase().includes("no qr code found")) {
            logger.warn(`[QRScanner] Scan Failure (other than 'not found'): ${errorMessage}`);
            // Можно установить scanError, если нужно показать пользователю
            // setScanError(t('qr_scanner.error.scan_generic'));
        }
    }, [t]);

    const handleStartScanRequest = () => {
        if (isProcessingScan || shouldBeScanning) return; // Не запускать, если уже обрабатывается или намерение есть
        setOrderDetails(null); 
        setApiError('');
        setScanError(''); 
        setIsLoadingApi(false);
        setShouldBeScanning(true);  
        setIsScannerUIVisible(true); 
        logger.info("[QRScanner] Scan request initiated.");
    };
    
    useEffect(() => {
        let scannerInstanceForEffect = null; 
        if (shouldBeScanning && isScannerUIVisible) {
            const readerElement = document.getElementById(qrReaderElementId);
            if (!readerElement) {
                logger.error("[QRScanner-Effect] QR Reader element not found in DOM.");
                setScanError(t('qr_scanner.error.camera_element_not_found'));
                setShouldBeScanning(false); setIsScannerUIVisible(false);
                return;
            }

            if (!html5QrCodeInstanceRef.current) {
                logger.info("[QRScanner-Effect] Initializing new Html5Qrcode instance.");
                scannerInstanceForEffect = new Html5Qrcode(qrReaderElementId, { verbose: false });
                html5QrCodeInstanceRef.current = scannerInstanceForEffect;
            } else {
                scannerInstanceForEffect = html5QrCodeInstanceRef.current;
                logger.info("[QRScanner-Effect] Using existing Html5Qrcode instance.");
            }
            
            const currentScanner = scannerInstanceForEffect;
            // Проверяем состояние перед вызовом start, чтобы избежать ошибок, если уже сканирует
            if (currentScanner && currentScanner.getState() !== 2 /* Html5Qrcode.SCANNING */) {
                logger.info("[QRScanner-Effect] Starting camera stream...");
                const config = { 
                    fps: 5, 
                    qrbox: (vw, vh) => { const s = Math.min(vw,vh) * 0.7; return {width:Math.max(200,s), height:Math.max(200,s)};},
                    rememberLastUsedCamera: true,
                    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
                    formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ]
                };
                currentScanner.start({ facingMode: "environment" }, config, onScanSuccess, onScanFailure)
                    .then(() => { logger.info("[QRScanner-Effect] Camera stream started successfully."); setScanError(''); })
                    .catch(err => {
                        logger.error("[QRScanner-Effect] Error starting QR scanner:", err);
                        let errorKey = 'qr_scanner.error.camera_start_error';
                        if (err && (err.name === 'NotAllowedError' || String(err).toLowerCase().includes('permission'))) { errorKey = 'qr_scanner.error.camera_permission_error'; }
                        else if (err && (err.name === 'NotFoundError' || String(err).toLowerCase().includes('not found'))) { errorKey = 'qr_scanner.error.no_cameras_found'; }
                        setScanError(t(errorKey));
                        setShouldBeScanning(false); setIsScannerUIVisible(false);
                        if (html5QrCodeInstanceRef.current === currentScanner) { // Очищаем ref, только если это тот же инстанс
                            try { currentScanner.clear(); } catch(e) { logger.error("Error clearing scanner after start fail:", e); }
                            html5QrCodeInstanceRef.current = null;
                        }
                    });
            } else if (currentScanner && currentScanner.getState() === 2) {
                 logger.info("[QRScanner-Effect] Scanner already in SCANNING state.");
            }
        }

        return () => { // Функция очистки для этого useEffect
            if (scannerInstanceForEffect && scannerInstanceForEffect === html5QrCodeInstanceRef.current) {
                logger.info("[QRScanner-Effect] Cleaning up scanner instance from effect (shouldBeScanning/isScannerUIVisible changed).");
                // Не вызываем cleanupScanner здесь напрямую, чтобы избежать двойной очистки,
                // если cleanupScanner вызывается из onScanSuccess или handleStopScanRequest.
                // cleanupScanner должен быть основным методом для остановки.
                // Этот useEffect отвечает за ЗАПУСК. Остановка - по другим триггерам.
            }
        };
    }, [shouldBeScanning, isScannerUIVisible, onScanSuccess, onScanFailure, t, qrReaderElementId]);

    // Автозапуск сканера при монтировании (если пользователь персонал)
    useEffect(() => {
        if (!isLoadingAuth && isAuthenticated && user?.is_staff) {
            handleStartScanRequest();
        }
        // Глобальная очистка при размонтировании всего компонента
        return () => {
            logger.info("[QRScanner] Component unmounting, ensuring final scanner cleanup.");
            cleanupScanner(true); 
        };
    }, [isLoadingAuth, isAuthenticated, user, cleanupScanner]); // cleanupScanner добавлен

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualOrderCode.trim() && !isProcessingScan) {
            setIsProcessingScan(true);
            setShouldBeScanning(false); 
            cleanupScanner(false); 

            setOrderDetails(null); setApiError(''); setIsLoadingApi(true);
            fetchOrderMutation.mutate(manualOrderCode.trim());
        }
    };

    const handleCompleteOrder = () => {
        if (orderDetails?.order_code) {
            completeOrderMutation.mutate(orderDetails.order_code);
        }
    };

    const handleScanNew = async () => {
        await cleanupScanner(false); 
        setOrderDetails(null); setApiError(''); setScanError('');
        setManualOrderCode(''); setIsLoadingApi(false); setIsProcessingScan(false);
        handleStartScanRequest(); // Используем эту функцию для корректной инициализации
    };
    
    const orderDisplayDetails = useMemo(() => {
        if (!orderDetails) return null;
        const { user_email, facility, order_type_display, status_display, display_date_period, display_time_range } = orderDetails;
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        const facilityNameDisplay = facility?.name || t('common.unknown_facility', 'Объект не указан');
        const universityNameDisplay = facility?.university_short_name || facility?.university_name || t('common.unknown_university', 'Университет не указан');
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
        return (
            <>
                {user_email && <p><strong>{t('qr_scanner.details.user_email', 'Email клиента')}:</strong> {user_email}</p>}
                <p><strong>{t('qr_scanner.details.facility')}:</strong> {facilityNameDisplay} ({universityNameDisplay})</p>                <p><strong>{t('qr_scanner.details.type')}:</strong> {order_type_display || 'N/A'}</p>
                <p><strong>{t('qr_scanner.details.date_period')}:</strong> {display_date_period || '-'}</p>
                {display_time_range && display_time_range !== '-' && <p><strong>{t('qr_scanner.details.time_range')}:</strong> {display_time_range}</p>}
                <p><strong>{t('qr_scanner.details.status')}:</strong> 
                    <span className={clsx(styles.statusBadge, styles[`status${orderDetails.status}`])}>
                        {status_display || 'N/A'}
                    </span>
                </p>
            </>
        );
    }, [orderDetails, t]);

    if (isLoadingAuth) {
        return <div className={styles.pageContainer}><LoadingSpinner text={t('common.checking_access', 'Проверка доступа...')}/></div>;
    }
    if (!isAuthenticated || !user?.is_staff) {
        return <div className={styles.pageContainer}><p className={styles.errorMessage}>{t('errors.auth_staff_required_page_access')}</p></div>;
    }

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.pageTitle}>{t('qr_scanner.title')}</h1>

            {isScannerUIVisible && <div id={qrReaderElementId} className={styles.scannerViewfinder}></div>}
            
            {!isScannerUIVisible && !orderDetails && !scanError && !isLoadingApi && !isProcessingScan && (
                 <div className={styles.scannerPlaceholder}>
                    <p>{t('qr_scanner.scanner_idle_click_to_start')}</p>
                 </div>
            )}

            {scanError && <p className={clsx(styles.message, styles.errorMessage)}>{scanError}</p>}

            <div className={styles.scannerControls}>
                {(!shouldBeScanning || !isScannerUIVisible) && !isProcessingScan && (
                    <button onClick={handleStartScanRequest} className={clsx(styles.button, styles.scanNewButton)}>
                        <i className="fas fa-qrcode"></i>
                        {orderDetails || apiError || scanError ? t('qr_scanner.scan_new_button') : t('qr_scanner.start_scan_button')}
                    </button>
                )}
                {shouldBeScanning && isScannerUIVisible && !isProcessingScan && (
                    <button onClick={async () => { await cleanupScanner(true); }} className={clsx(styles.button, styles.stopScanButton)}>
                        <i className="fas fa-stop-circle"></i> {t('qr_scanner.stop_scan_button')}
                    </button>
                )}
            </div>

            <form onSubmit={handleManualSubmit} className={styles.manualInputForm}>
                <input 
                    type="text" value={manualOrderCode}
                    onChange={(e) => setManualOrderCode(e.target.value)}
                    placeholder={t('qr_scanner.manual_input_placeholder')}
                    className={styles.manualInput}
                    aria-label={t('qr_scanner.manual_input_placeholder')}
                    disabled={isLoadingApi || isProcessingScan}
                />
                <button type="submit" className={styles.button} disabled={isLoadingApi || isProcessingScan || !manualOrderCode.trim()}>
                    {(isLoadingApi && !isProcessingScan) ? <LoadingSpinner size="1em" color="#fff" /> : <i className="fas fa-search"></i>}
                    {t('qr_scanner.find_button')}
                </button>
            </form>

            {isLoadingApi && <div className={styles.loadingMessage}><LoadingSpinner text={t('common.loading', 'Поиск заказа...')}/></div>}
            {apiError && !isLoadingApi && <p className={clsx(styles.message, styles.errorMessage)}>{apiError}</p>}

            {orderDetails && !isLoadingApi && (
                <div className={styles.orderDetailsContainer}>
                    <h2 className={styles.detailsTitle}>{t('qr_scanner.details.section_title')}: {orderDetails.order_code}</h2>
                    <div className={styles.detailsContent}>{orderDisplayDetails}</div>
                    <div className={styles.actionsContainer}>
                        {orderDetails.order_type !== 'subscription' && orderDetails.status === 'confirmed' && (
                            <button 
                                onClick={handleCompleteOrder} 
                                className={clsx(styles.button, styles.completeButton)}
                                disabled={completeOrderMutation.isLoading}
                            >
                                {completeOrderMutation.isLoading ? <LoadingSpinner size="1em" color="#fff"/> : <i className="fas fa-check-circle"></i>}
                                {t('qr_scanner.complete_button')}
                            </button>
                        )}
                         {/* Кнопка "Сканировать новый" теперь в scannerControls */}
                    </div>
                </div>
            )}
        </div>
    );
};

export default QRScannerPage;
// --- END OF FULL MODIFIED frontend/src/pages/QRScannerPage.jsx ---