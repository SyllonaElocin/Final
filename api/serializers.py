from rest_framework import serializers
from .models import User, Portfolio, Publication, CoAuthor

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role']

class CoAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoAuthor
        fields = ['id', 'name', 'affiliation']

class PublicationSerializer(serializers.ModelSerializer):
    co_authors = CoAuthorSerializer(many=True, read_only=True)
    researcher_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Publication
        fields = [
            'id', 'user_id', 'researcher_email', 'title', 'abstract', 
            'pdf_url', 'dataset_url', 'created_at', 'co_authors'
        ]

    def to_representation(self, instance):
        # Implement Object-Level Permissions dynamically during serialization
        # (Only owners or reviewers see pdf_url / dataset_url)
        rep = super().to_representation(instance)
        request = self.context.get('request')
        
        is_owner = request and request.user and request.user.is_authenticated and request.user.id == instance.user_id
        is_reviewer = request and request.user and request.user.is_authenticated and request.user.role == 'reviewer'

        if not (is_owner or is_reviewer):
            rep.pop('pdf_url', None)
            rep.pop('dataset_url', None)
            
        return rep
