import os
import uuid
import cloudinary
import cloudinary.uploader
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.hashers import make_password, check_password

from .models import User, Publication, CoAuthor
from .serializers import UserSerializer, PublicationSerializer

@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    data = request.data
    email = data.get('email')
    password = data.get('password')
    role = data.get('role', 'basic')

    if not email or not password:
        return Response({'error': 'Missing fields'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create(
        email=email,
        username=email,
        password=make_password(password),
        role=role
    )

    refresh = RefreshToken.for_user(user)
    # The frontend expects {id, email, role} in token and user obj
    refresh.payload['id'] = user.id
    refresh.payload['email'] = user.email
    refresh.payload['role'] = user.role

    return Response({
        'user': UserSerializer(user).data,
        'token': str(refresh.access_token)
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    data = request.data
    email = data.get('email')
    password = data.get('password')

    try:
        user = User.objects.get(email=email)
        if not check_password(password, user.password):
            raise User.DoesNotExist
    except User.DoesNotExist:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)
    refresh.payload['id'] = user.id
    refresh.payload['email'] = user.email
    refresh.payload['role'] = user.role

    return Response({
        'user': UserSerializer(user).data,
        'token': str(refresh.access_token)
    })

@api_view(['GET', 'POST'])
def publication_list_create(request):
    if request.method == 'GET':
        publications = Publication.objects.all().order_by('-created_at')
        serializer = PublicationSerializer(publications, many=True, context={'request': request})
        return Response(serializer.data)

    elif request.method == 'POST':
        if request.user.role != 'researcher':
            return Response({'error': 'Strict Object-level permission: Only researchers can upload portfolios'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        title = data.get('title')
        abstract = data.get('abstract')
        
        if not title or not abstract:
            return Response({'error': 'Title and abstract are required'}, status=status.HTTP_400_BAD_REQUEST)

        pub = Publication.objects.create(
            user=request.user,
            title=title,
            abstract=abstract,
            pdf_url=data.get('pdf_url'),
            dataset_url=data.get('dataset_url')
        )

        co_authors_data = data.get('co_authors', [])
        for author in co_authors_data:
            if author.get('name') and author.get('affiliation'):
                CoAuthor.objects.create(
                    publication=pub,
                    name=author['name'],
                    affiliation=author['affiliation']
                )

        return Response({'id': pub.id})

@api_view(['PUT'])
def publication_update(request, pk):
    if request.user.role != 'researcher':
        return Response({'error': 'Strict Object-level permission: Only researchers can edit publications'}, status=status.HTTP_403_FORBIDDEN)

    try:
        pub = Publication.objects.get(pk=pk)
    except Publication.DoesNotExist:
        return Response({'error': 'Publication not found'}, status=status.HTTP_404_NOT_FOUND)

    if pub.user != request.user:
        return Response({'error': 'Permission denied: You can only edit your own publications'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    pub.title = data.get('title', pub.title)
    pub.abstract = data.get('abstract', pub.abstract)
    if 'pdf_url' in data:
        pub.pdf_url = data['pdf_url']
    if 'dataset_url' in data:
        pub.dataset_url = data['dataset_url']

    pub.save()
    return Response({'success': True})

@api_view(['POST'])
def upload_file(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)

    # Setup Cloudinary
    has_cloudinary_url = bool(os.environ.get('CLOUDINARY_URL', '').startswith('cloudinary://'))
    has_keys = bool(os.environ.get('CLOUDINARY_CLOUD_NAME') and os.environ.get('CLOUDINARY_API_KEY') and os.environ.get('CLOUDINARY_API_SECRET'))

    if has_cloudinary_url or has_keys:
        if has_keys:
            cloudinary.config(
                cloud_name=os.environ.get('CLOUDINARY_CLOUD_NAME'),
                api_key=os.environ.get('CLOUDINARY_API_KEY'),
                api_secret=os.environ.get('CLOUDINARY_API_SECRET'),
                secure=True
            )
        else:
            cloudinary.config(secure=True)

        # Detect type
        name = file_obj.name.lower()
        is_image_or_pdf = any(name.endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'])
        resource_type = 'image' if is_image_or_pdf else 'raw'

        try:
            result = cloudinary.uploader.upload(file_obj, resource_type=resource_type)
            return Response({'url': result['secure_url']})
        except Exception as e:
            return Response({'error': f'Cloudinary upload failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'error': 'Cloudinary not configured'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
