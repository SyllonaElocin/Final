from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    # Using email as unique identifier for auth
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=50, default='basic')
    
    # Optional but good practice for customizing auth
    username = models.CharField(max_length=150, unique=False, blank=True, null=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email

class Portfolio(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='portfolios')
    bio = models.TextField(blank=True, null=True)
    credentials = models.TextField(blank=True, null=True)

class Publication(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='publications')
    title = models.CharField(max_length=255)
    abstract = models.TextField()
    pdf_url = models.URLField(max_length=500, blank=True, null=True)
    dataset_url = models.URLField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class CoAuthor(models.Model):
    publication = models.ForeignKey(Publication, on_delete=models.CASCADE, related_name='co_authors')
    name = models.CharField(max_length=255)
    affiliation = models.CharField(max_length=255)

    def __str__(self):
        return self.name
