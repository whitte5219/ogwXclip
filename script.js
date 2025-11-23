import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    get, 
    update, 
    remove,
    onValue
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyCyZ8aFdaUDS13ufGemvtBq2GUaQsfC-8E",
    authDomain: "ogwxclip.firebaseapp.com",
    databaseURL: "https://ogwxclip-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "ogwxclip",
    storageBucket: "ogwxclip.firebasestorage.app",
    messagingSenderId: "349266580692",
    appId: "1:349266580692:web:2f6d495a59c008837ed741",
    measurementId: "G-XP58YLSWXE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Database references
const postsRef = ref(db, "posts");
const reactionsRef = ref(db, "reactions");
const cooldownsRef = ref(db, "userCooldowns");

// Global variables
let currentUserId = null;
let currentPosts = [];
let editingPostId = null;
let cooldownInterval = null;
let currentUserReaction = null;

// File storage variables
let selectedPhotos = [];
let selectedVideos = [];
let editSelectedPhotos = [];
let editSelectedVideos = [];

// DOM Elements
const postBtn = document.getElementById('post-btn');
const searchBtn = document.getElementById('search-btn');
const yourPostsBtn = document.getElementById('your-posts-btn');
const searchSection = document.getElementById('search-section');
const yourPostsSection = document.getElementById('your-posts-section');
const searchResults = document.getElementById('search-results');
const userPosts = document.getElementById('user-posts');
const filterBtn = document.getElementById('filter-btn');
const filtersPanel = document.getElementById('filters-panel');
const applyFiltersBtn = document.getElementById('apply-filters');
const searchInput = document.getElementById('search-input');
const searchSubmit = document.getElementById('search-submit');

// Popup elements
const postPopup = document.getElementById('post-popup');
const postDetailsPopup = document.getElementById('post-details-popup');
const editPostPopup = document.getElementById('edit-post-popup');
const cooldownNotification = document.getElementById('cooldown-notification');
const mediaZoomPopup = document.getElementById('media-zoom-popup');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeUser();
    setupEventListeners();
    loadAllPosts();
    updatePostButtonState();
});

// Generate unique user ID
function initializeUser() {
    currentUserId = localStorage.getItem('ogwXclip_userId');
    if (!currentUserId) {
        currentUserId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('ogwXclip_userId', currentUserId);
    }
}

// Event listeners setup
function setupEventListeners() {
    // Navigation
    postBtn.addEventListener('click', openPostPopup);
    searchBtn.addEventListener('click', () => showSection('search'));
    yourPostsBtn.addEventListener('click', () => {
        showSection('your-posts');
        loadUserPosts();
    });

    // Search and filters
    filterBtn.addEventListener('click', toggleFilters);
    applyFiltersBtn.addEventListener('click', applyFilters);
    searchSubmit.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });

    // Post creation
    document.getElementById('cancel-post').addEventListener('click', closePostPopup);
    document.getElementById('submit-post').addEventListener('click', submitPost);
    
    // Character counters
    document.getElementById('post-name').addEventListener('input', updateCharCounters);
    document.getElementById('post-description').addEventListener('input', updateCharCounters);
    document.getElementById('edit-post-name').addEventListener('input', updateEditCharCounters);
    document.getElementById('edit-post-description').addEventListener('input', updateEditCharCounters);

    // File upload handlers
    document.getElementById('photo-upload').addEventListener('change', handlePhotoUpload);
    document.getElementById('video-upload').addEventListener('change', handleVideoUpload);
    document.getElementById('edit-photo-upload').addEventListener('change', handleEditPhotoUpload);
    document.getElementById('edit-video-upload').addEventListener('change', handleEditVideoUpload);

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.getAttribute('data-tab');
            switchTab(tabName, e.target.closest('.media-tabs'));
        });
    });

    // Post details
    document.getElementById('close-details').addEventListener('click', closePostDetails);
    
    // Edit post
    document.getElementById('cancel-edit').addEventListener('click', closeEditPopup);
    document.getElementById('save-edit').addEventListener('click', saveEdit);

    // Media zoom
    document.getElementById('close-zoom').addEventListener('click', closeMediaZoom);
}

// Show/hide sections
function showSection(sectionName) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
    
    if (sectionName === 'search') {
        searchBtn.classList.add('active');
        searchSection.classList.add('active');
    } else if (sectionName === 'your-posts') {
        yourPostsBtn.classList.add('active');
        yourPostsSection.classList.add('active');
    }
}

// Tab switching
function switchTab(tabName, tabsContainer) {
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabsContainer.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    tabsContainer.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    tabsContainer.querySelector(`#${tabName}-tab`).classList.add('active');
}

// Load all posts for search
function loadAllPosts() {
    onValue(postsRef, (snapshot) => {
        currentPosts = [];
        snapshot.forEach((childSnapshot) => {
            const post = childSnapshot.val();
            post.id = childSnapshot.key;
            currentPosts.push(post);
        });
        displayPosts(currentPosts, searchResults);
    });
}

// Display posts in grid
function displayPosts(posts, container) {
    if (posts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Posts Found</h3>
                <p>Try adjusting your search criteria or filters.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-name">${post.name}</div>
                ${post.userId === currentUserId ? `
                    <button class="delete-post-btn" title="Delete Post">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            </div>
            <div class="post-date">${formatDate(post.timestamp)}</div>
            ${post.edited ? '<span class="edited-badge">(post was edited)</span>' : ''}
            <div class="post-actions">
                <button class="btn view-details-btn">
                    <i class="fas fa-eye"></i> View Details
                </button>
                ${post.userId === currentUserId ? `
                    <button class="btn btn-secondary edit-post-btn">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.view-details-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.target.closest('.post-card').getAttribute('data-post-id');
            openPostDetails(postId);
        });
    });

    container.querySelectorAll('.edit-post-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.target.closest('.post-card').getAttribute('data-post-id');
            openEditPopup(postId);
        });
    });

    container.querySelectorAll('.delete-post-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const postId = e.target.closest('.post-card').getAttribute('data-post-id');
            deletePost(postId);
        });
    });
}

// Load user's posts
function loadUserPosts() {
    const userPostsList = currentPosts.filter(post => post.userId === currentUserId);
    displayPosts(userPostsList, userPosts);
}

// Search functionality
function performSearch() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    let filteredPosts = currentPosts;

    if (searchTerm) {
        filteredPosts = filteredPosts.filter(post => 
            post.name.toLowerCase().includes(searchTerm) ||
            post.description.toLowerCase().includes(searchTerm)
        );
    }

    const beforeDate = document.getElementById('filter-before').value;
    const afterDate = document.getElementById('filter-after').value;
    const mediaType = document.getElementById('filter-type').value;

    if (beforeDate) {
        filteredPosts = filteredPosts.filter(post => post.timestamp < new Date(beforeDate).getTime());
    }

    if (afterDate) {
        filteredPosts = filteredPosts.filter(post => post.timestamp > new Date(afterDate).getTime());
    }

    if (mediaType !== 'all') {
        filteredPosts = filteredPosts.filter(post => {
            if (mediaType === 'photo') return post.photos && post.photos.length > 0;
            if (mediaType === 'video') return post.videos && post.videos.length > 0;
            return true;
        });
    }

    displayPosts(filteredPosts, searchResults);
}

// Filter controls
function toggleFilters() {
    filtersPanel.classList.toggle('hidden');
}

function applyFilters() {
    performSearch();
    filtersPanel.classList.add('hidden');
}

// File upload functions
function handlePhotoUpload(event) {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        alert('Please select valid image files (JPEG, PNG, GIF, etc.)');
        return;
    }
    
    // Check file sizes (2MB limit for images)
    const oversizedFiles = validFiles.filter(file => file.size > 2 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        alert('Some images exceed the 2MB size limit. Please select smaller files.');
        return;
    }
    
    selectedPhotos = validFiles;
    updatePhotoPreview();
}

function handleVideoUpload(event) {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (validFiles.length === 0) {
        alert('Please select valid video files (MP4, WebM, etc.)');
        return;
    }
    
    // Check file sizes (5MB limit for videos)
    const oversizedFiles = validFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        alert('Some videos exceed the 5MB size limit. Please select smaller files.');
        return;
    }
    
    selectedVideos = validFiles;
    updateVideoPreview();
}

function handleEditPhotoUpload(event) {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        alert('Please select valid image files (JPEG, PNG, GIF, etc.)');
        return;
    }
    
    const oversizedFiles = validFiles.filter(file => file.size > 2 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        alert('Some images exceed the 2MB size limit. Please select smaller files.');
        return;
    }
    
    editSelectedPhotos = validFiles;
    updateEditPhotoPreview();
}

function handleEditVideoUpload(event) {
    const files = Array.from(event.target.files);
    const validFiles = files.filter(file => file.type.startsWith('video/'));
    
    if (validFiles.length === 0) {
        alert('Please select valid video files (MP4, WebM, etc.)');
        return;
    }
    
    const oversizedFiles = validFiles.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
        alert('Some videos exceed the 5MB size limit. Please select smaller files.');
        return;
    }
    
    editSelectedVideos = validFiles;
    updateEditVideoPreview();
}

// Preview update functions
function updatePhotoPreview() {
    const preview = document.getElementById('photo-preview');
    const count = document.getElementById('photo-count');
    const size = document.getElementById('photo-size');
    
    const totalSize = selectedPhotos.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    count.textContent = `${selectedPhotos.length} photos selected`;
    size.textContent = `${sizeMB} MB`;
    
    preview.innerHTML = selectedPhotos.map((file, index) => `
        <div class="preview-item">
            <img src="${URL.createObjectURL(file)}" alt="Preview">
            <button class="remove-preview" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Add remove event listeners
    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            selectedPhotos.splice(index, 1);
            updatePhotoPreview();
        });
    });
}

function updateVideoPreview() {
    const preview = document.getElementById('video-preview');
    const count = document.getElementById('video-count');
    const size = document.getElementById('video-size');
    
    const totalSize = selectedVideos.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    count.textContent = `${selectedVideos.length} videos selected`;
    size.textContent = `${sizeMB} MB`;
    
    preview.innerHTML = selectedVideos.map((file, index) => `
        <div class="preview-item">
            <video>
                <source src="${URL.createObjectURL(file)}" type="${file.type}">
            </video>
            <button class="remove-preview" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Add remove event listeners
    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            selectedVideos.splice(index, 1);
            updateVideoPreview();
        });
    });
}

function updateEditPhotoPreview() {
    const preview = document.getElementById('edit-photo-preview');
    const count = document.getElementById('edit-photo-count');
    const size = document.getElementById('edit-photo-size');
    
    const totalSize = editSelectedPhotos.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    count.textContent = `${editSelectedPhotos.length} photos selected`;
    size.textContent = `${sizeMB} MB`;
    
    preview.innerHTML = editSelectedPhotos.map((file, index) => `
        <div class="preview-item">
            <img src="${URL.createObjectURL(file)}" alt="Preview">
            <button class="remove-preview" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Add remove event listeners
    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            editSelectedPhotos.splice(index, 1);
            updateEditPhotoPreview();
        });
    });
}

function updateEditVideoPreview() {
    const preview = document.getElementById('edit-video-preview');
    const count = document.getElementById('edit-video-count');
    const size = document.getElementById('edit-video-size');
    
    const totalSize = editSelectedVideos.reduce((sum, file) => sum + file.size, 0);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    
    count.textContent = `${editSelectedVideos.length} videos selected`;
    size.textContent = `${sizeMB} MB`;
    
    preview.innerHTML = editSelectedVideos.map((file, index) => `
        <div class="preview-item">
            <video>
                <source src="${URL.createObjectURL(file)}" type="${file.type}">
            </video>
            <button class="remove-preview" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Add remove event listeners
    preview.querySelectorAll('.remove-preview').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            editSelectedVideos.splice(index, 1);
            updateEditVideoPreview();
        });
    });
}

// File to Base64 conversion
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Post creation
function openPostPopup() {
    checkCooldown().then(canPost => {
        if (canPost) {
            postPopup.classList.remove('hidden');
            setTimeout(() => postPopup.classList.add('active'), 10);
            document.getElementById('post-name').value = '';
            document.getElementById('post-description').value = '';
            
            // Reset file selections
            selectedPhotos = [];
            selectedVideos = [];
            updatePhotoPreview();
            updateVideoPreview();
            
            updateCharCounters();
        } else {
            const remaining = getRemainingCooldown();
            if (remaining > 0) {
                showCooldownNotification(remaining);
            }
        }
    });
}

function closePostPopup() {
    postPopup.classList.remove('active');
    setTimeout(() => postPopup.classList.add('hidden'), 200);
}

function updateCharCounters() {
    document.getElementById('name-chars').textContent = document.getElementById('post-name').value.length;
    document.getElementById('desc-chars').textContent = document.getElementById('post-description').value.length;
}

function updateEditCharCounters() {
    document.getElementById('edit-name-chars').textContent = document.getElementById('edit-post-name').value.length;
    document.getElementById('edit-desc-chars').textContent = document.getElementById('edit-post-description').value.length;
}

async function submitPost() {
    const name = document.getElementById('post-name').value.trim();
    const description = document.getElementById('post-description').value.trim();

    // Validation
    if (!name) {
        alert('Please enter a post name');
        return;
    }

    if (!description) {
        alert('Please enter a description');
        return;
    }

    if (selectedPhotos.length === 0 && selectedVideos.length === 0) {
        alert('Please add at least one photo or video');
        return;
    }

    // Check cooldown
    const canPost = await checkCooldown();
    if (!canPost) {
        const remaining = getRemainingCooldown();
        showCooldownNotification(remaining);
        return;
    }

    // Show loading state
    const submitBtn = document.getElementById('submit-post');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';

    try {
        // Convert files to Base64
        const photoPromises = selectedPhotos.map(file => fileToBase64(file));
        const videoPromises = selectedVideos.map(file => fileToBase64(file));
        
        const [photoBase64, videoBase64] = await Promise.all([
            Promise.all(photoPromises),
            Promise.all(videoPromises)
        ]);

        // Create post object
        const postData = {
            name: name,
            description: description,
            photos: photoBase64,
            videos: videoBase64,
            userId: currentUserId,
            timestamp: Date.now(),
            edited: false
        };

        // Save to Firebase
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        // Set cooldown
        await set(ref(db, `userCooldowns/${currentUserId}`), Date.now());
        
        closePostPopup();
        updatePostButtonState();
        
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post';
    }
}

// Cooldown system - FIXED: Added timer display
async function checkCooldown() {
    try {
        const cooldownSnap = await get(ref(db, `userCooldowns/${currentUserId}`));
        const lastPostTime = cooldownSnap.val();
        
        if (lastPostTime) {
            const cooldownEnd = lastPostTime + (2 * 60 * 1000);
            if (Date.now() < cooldownEnd) {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error checking cooldown:', error);
        return true;
    }
}

function getRemainingCooldown() {
    return new Promise((resolve) => {
        get(ref(db, `userCooldowns/${currentUserId}`)).then((cooldownSnap) => {
            const lastPostTime = cooldownSnap.val();
            if (lastPostTime) {
                const cooldownEnd = lastPostTime + (2 * 60 * 1000);
                const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
                resolve(remaining > 0 ? remaining : 0);
            } else {
                resolve(0);
            }
        }).catch(() => resolve(0));
    });
}

function updatePostButtonState() {
    get(ref(db, `userCooldowns/${currentUserId}`)).then((cooldownSnap) => {
        const lastPostTime = cooldownSnap.val();
        
        if (lastPostTime) {
            const cooldownEnd = lastPostTime + (2 * 60 * 1000);
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            
            if (remaining > 0) {
                // Still in cooldown - disable button and show timer
                postBtn.disabled = true;
                postBtn.classList.add('disabled');
                startCooldownTimer(remaining);
                
                // NEW: Show timer notification
                showCooldownNotification(remaining);
            } else {
                // Cooldown finished
                postBtn.disabled = false;
                postBtn.classList.remove('disabled');
                postBtn.innerHTML = '<i class="fas fa-plus"></i> Post';
                if (cooldownInterval) {
                    clearInterval(cooldownInterval);
                    cooldownInterval = null;
                }
            }
        } else {
            // No cooldown
            postBtn.disabled = false;
            postBtn.classList.remove('disabled');
            postBtn.innerHTML = '<i class="fas fa-plus"></i> Post';
        }
    });
}

function startCooldownTimer(remainingSeconds) {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
    }
    
    cooldownInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            clearInterval(cooldownInterval);
            cooldownInterval = null;
            updatePostButtonState();
            return;
        }
        
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        postBtn.innerHTML = `Wait ${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update notification if visible
        if (!cooldownNotification.classList.contains('hidden')) {
            document.getElementById('cooldown-message').textContent = 
                `Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before posting again`;
        }
    }, 1000);
}

function showCooldownNotification(remainingSeconds) {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    document.getElementById('cooldown-message').textContent = 
        `Please wait ${minutes}:${seconds.toString().padStart(2, '0')} before posting again`;
    
    cooldownNotification.classList.remove('hidden');
    setTimeout(() => {
        cooldownNotification.classList.add('hidden');
    }, 5000);
}

// Post details - FIXED: View details now works
async function openPostDetails(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;

    const reactions = await getReactions(postId);

    document.getElementById('detail-post-name').textContent = post.name;
    document.getElementById('detail-post-date').textContent = formatDate(post.timestamp, true);
    document.getElementById('detail-post-description').textContent = post.description;
    
    const editedBadge = document.getElementById('detail-edited');
    if (post.edited) {
        editedBadge.classList.remove('hidden');
    } else {
        editedBadge.classList.add('hidden');
    }

    const deleteButton = document.getElementById('delete-post-btn');
    if (post.userId === currentUserId) {
        deleteButton.classList.remove('hidden');
        deleteButton.onclick = () => deletePost(postId);
    } else {
        deleteButton.classList.add('hidden');
    }

    loadMediaGallery(post.photos, 'photos-gallery', 'photo', postId);
    loadMediaGallery(post.videos, 'videos-gallery', 'video', postId);

    updateReactionCounts(reactions);
    setupReactionButtons(postId, reactions);

    postDetailsPopup.classList.remove('hidden');
    setTimeout(() => postDetailsPopup.classList.add('active'), 10);
}

function closePostDetails() {
    postDetailsPopup.classList.remove('active');
    setTimeout(() => postDetailsPopup.classList.add('hidden'), 200);
}

function loadMediaGallery(mediaArray, galleryId, mediaType, postId) {
    const gallery = document.getElementById(galleryId);
    
    if (!mediaArray || mediaArray.length === 0) {
        gallery.innerHTML = `<p style="color: var(--text-secondary); text-align: center;">No ${mediaType}s available</p>`;
        return;
    }

    gallery.innerHTML = mediaArray.map((base64, index) => {
        if (mediaType === 'photo') {
            return `
                <div class="media-item" data-media-type="photo" data-url="${base64}" data-post-id="${postId}">
                    <img src="${base64}" alt="Post photo">
                </div>
            `;
        } else {
            return `
                <div class="media-item" data-media-type="video" data-url="${base64}" data-post-id="${postId}">
                    <video controls>
                        <source src="${base64}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        }
    }).join('');

    gallery.querySelectorAll('.media-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.tagName === 'VIDEO' || e.target.tagName === 'SOURCE') return;
            
            const mediaType = item.getAttribute('data-media-type');
            const url = item.getAttribute('data-url');
            openMediaZoom(url, mediaType);
        });
    });
}

// Media zoom functionality
function openMediaZoom(url, mediaType) {
    const zoomMedia = document.getElementById('zoom-media');
    zoomMedia.innerHTML = '';

    if (mediaType === 'photo') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Zoomed photo';
        zoomMedia.appendChild(img);
    } else {
        const video = document.createElement('video');
        video.controls = true;
        video.autoplay = true;
        const source = document.createElement('source');
        source.src = url;
        source.type = 'video/mp4';
        video.appendChild(source);
        zoomMedia.appendChild(video);
    }

    mediaZoomPopup.classList.remove('hidden');
    setTimeout(() => mediaZoomPopup.classList.add('active'), 10);
}

function closeMediaZoom() {
    mediaZoomPopup.classList.remove('active');
    setTimeout(() => {
        mediaZoomPopup.classList.add('hidden');
        const video = document.querySelector('#zoom-media video');
        if (video) {
            video.pause();
            video.currentTime = 0;
        }
    }, 200);
}

// Reactions system
async function getReactions(postId) {
    try {
        const reactionsSnap = await get(ref(db, `reactions/${postId}`));
        return reactionsSnap.val() || {};
    } catch (error) {
        console.error('Error loading reactions:', error);
        return {};
    }
}

function updateReactionCounts(reactions) {
    let likes = 0;
    let dislikes = 0;

    Object.values(reactions).forEach(reaction => {
        if (reaction.type === 'like') likes++;
        if (reaction.type === 'dislike') dislikes++;
    });

    document.getElementById('like-count').textContent = likes;
    document.getElementById('dislike-count').textContent = dislikes;
}

function setupReactionButtons(postId, reactions) {
    const userReaction = reactions[currentUserId];
    currentUserReaction = userReaction ? userReaction.type : null;
    
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.onclick = (e) => handleReaction(postId, e);
        
        if (userReaction && btn.getAttribute('data-reaction') === userReaction.type) {
            btn.classList.add('active');
        }
    });
}

async function handleReaction(postId, event) {
    const reactionType = event.currentTarget.getAttribute('data-reaction');
    const reactionRef = ref(db, `reactions/${postId}/${currentUserId}`);
    
    try {
        if (currentUserReaction === reactionType) {
            await remove(reactionRef);
            currentUserReaction = null;
        } else {
            await set(reactionRef, {
                type: reactionType,
                timestamp: Date.now()
            });
            currentUserReaction = reactionType;
        }
        
        const updatedReactions = await getReactions(postId);
        updateReactionCounts(updatedReactions);
        setupReactionButtons(postId, updatedReactions);
        
    } catch (error) {
        console.error('Error saving reaction:', error);
    }
}

// Delete post function
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    try {
        await remove(ref(db, `posts/${postId}`));
        await remove(ref(db, `reactions/${postId}`));
        closePostDetails();
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
    }
}

// Edit post system - FIXED: Now shows existing media in edit
function openEditPopup(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post || post.userId !== currentUserId) return;

    editingPostId = postId;
    
    document.getElementById('edit-post-name').value = post.name;
    document.getElementById('edit-post-description').value = post.description;
    updateEditCharCounters();
    
    // NEW: Show existing media in edit preview
    const existingPhotos = post.photos || [];
    const existingVideos = post.videos || [];
    
    // Convert existing Base64 to preview items
    const editPhotoPreview = document.getElementById('edit-photo-preview');
    const editVideoPreview = document.getElementById('edit-video-preview');
    
    editPhotoPreview.innerHTML = existingPhotos.map((base64, index) => `
        <div class="preview-item">
            <img src="${base64}" alt="Existing photo">
            <button class="remove-preview existing-media" data-index="${index}" data-type="existing">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    editVideoPreview.innerHTML = existingVideos.map((base64, index) => `
        <div class="preview-item">
            <video>
                <source src="${base64}" type="video/mp4">
            </video>
            <button class="remove-preview existing-media" data-index="${index}" data-type="existing">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    // Update counts for existing media
    document.getElementById('edit-photo-count').textContent = `${existingPhotos.length} photos selected`;
    document.getElementById('edit-video-count').textContent = `${existingVideos.length} videos selected`;
    
    // Store existing media for saving
    editSelectedPhotos = [];
    editSelectedVideos = [];
    
    // Add remove listeners for existing media
    document.querySelectorAll('.existing-media').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            const type = this.getAttribute('data-type');
            
            if (type === 'existing') {
                // Remove from preview (we'll handle this in save by not including removed items)
                this.closest('.preview-item').remove();
                
                // Update counts
                const remainingPhotos = document.querySelectorAll('#edit-photo-preview .preview-item').length;
                const remainingVideos = document.querySelectorAll('#edit-video-preview .preview-item').length;
                
                document.getElementById('edit-photo-count').textContent = `${remainingPhotos} photos selected`;
                document.getElementById('edit-video-count').textContent = `${remainingVideos} videos selected`;
            }
        });
    });
    
    editPostPopup.classList.remove('hidden');
    setTimeout(() => editPostPopup.classList.add('active'), 10);
}

function closeEditPopup() {
    editingPostId = null;
    editPostPopup.classList.remove('active');
    setTimeout(() => editPostPopup.classList.add('hidden'), 200);
}

async function saveEdit() {
    if (!editingPostId) return;

    const name = document.getElementById('edit-post-name').value.trim();
    const description = document.getElementById('edit-post-description').value.trim();

    if (!name || !description) {
        alert('Please fill in all fields');
        return;
    }

    try {
        // Get existing media that wasn't removed
        const existingPhotoPreviews = document.querySelectorAll('#edit-photo-preview .preview-item img');
        const existingVideoPreviews = document.querySelectorAll('#edit-video-preview .preview-item video source');
        
        const existingPhotos = Array.from(existingPhotoPreviews).map(img => img.src);
        const existingVideos = Array.from(existingVideoPreviews).map(source => source.src);
        
        // Convert new files to Base64
        const newPhotoPromises = editSelectedPhotos.map(file => fileToBase64(file));
        const newVideoPromises = editSelectedVideos.map(file => fileToBase64(file));
        
        const [newPhotosBase64, newVideosBase64] = await Promise.all([
            Promise.all(newPhotoPromises),
            Promise.all(newVideoPromises)
        ]);

        // Combine existing and new media
        const allPhotos = [...existingPhotos, ...newPhotosBase64];
        const allVideos = [...existingVideos, ...newVideosBase64];

        if (allPhotos.length === 0 && allVideos.length === 0) {
            alert('Please add at least one photo or video');
            return;
        }

        await update(ref(db, `posts/${editingPostId}`), {
            name: name,
            description: description,
            photos: allPhotos,
            videos: allVideos,
            edited: true
        });

        closeEditPopup();
        
    } catch (error) {
        console.error('Error updating post:', error);
        alert('Failed to update post. Please try again.');
    }
}

// Utility functions
function formatDate(timestamp, includeTime = false) {
    const date = new Date(timestamp);
    if (includeTime) {
        return date.toLocaleString();
    }
    return date.toLocaleDateString();
}

// Initialize with search section active
showSection('search');
