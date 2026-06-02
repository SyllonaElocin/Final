from django.urls import path
from . import views

urlpatterns = [
    path('auth/register', views.register_view),
    path('auth/login', views.login_view),
    path('publications', views.publication_list_create),
    path('publications/<int:pk>', views.publication_update),
    path('upload', views.upload_file),
]
