from django.urls import path
from . import views

urlpatterns = [
    path("", views.home , name='home'), 
    path("network", views.network, name="network"),
    path("sGene", views.sGene, name="sGene"),
    path("sgsearch", views.sgsearch, name="sgsearch"),
    path("mgsearch", views.mgsearch, name="mgsearch"),
    path("upload", views.upload, name="upload"),
    path("contact", views.contact, name="contact"),
    path("guide", views.guide, name="guide")
]