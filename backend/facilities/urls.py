from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    FacilityViewSet,
    AmenityViewSet,
    get_facility_availability,
    # get_subscription_availability, # <-- УДАЛЕНО
    get_comprehensive_subscription_availability
)
app_name='facilities'
router = DefaultRouter()
router.register(r'facilities', FacilityViewSet, basename='facility')
router.register(r'amenities', AmenityViewSet, basename='amenity')

urlpatterns = [
    path('', include(router.urls)),
    path('facilities/<int:facility_id>/availability/', get_facility_availability, name='facility-availability'),
    # Старый URL удален:
    # path('facilities/<int:facility_id>/subscription-availability/', get_subscription_availability, name='facility-subscription-availability-legacy'),
    path('facilities/<int:facility_id>/comprehensive-subscription-availability/', get_comprehensive_subscription_availability, name='facility-comprehensive-subscription-availability'),
]