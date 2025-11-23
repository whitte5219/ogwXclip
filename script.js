import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    get, 
    update, 
    remove,
    onValue,
    query,
    orderByChild,
    startAt,
    endAt
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
    updatePostButtonState(); // Check cooldown on page load
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
    // Update nav active state
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
    // Update tab buttons
    tabsContainer.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    tabsContainer.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
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

// Display posts in grid - FIXED: Delete button in top right corner
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

    // NEW: Delete post buttons
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

    // Apply text search
    if (searchTerm) {
        filteredPosts = filteredPosts.filter(post => 
            post.name.toLowerCase().includes(searchTerm) ||
            post.description.toLowerCase().includes(searchTerm)
        );
    }

    // Apply filters
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

// Post creation - FIXED: Proper cooldown blocking
function openPostPopup() {
    // Check cooldown
    checkCooldown().then(canPost => {
        if (canPost) {
            postPopup.classList.remove('hidden');
            setTimeout(() => postPopup.classList.add('active'), 10);
            document.getElementById('post-name').value = '';
            document.getElementById('post-description').value = '';
            document.getElementById('photo-urls').value = '';
            document.getElementById('video-urls').value = '';
            updateCharCounters();
        } else {
            // Show notification if still in cooldown
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
    const photoUrls = document.getElementById('photo-urls').value.split('\n').filter(url => url.trim());
    const videoUrls = document.getElementById('video-urls').value.split('\n').filter(url => url.trim());

    // Validation
    if (!name) {
        alert('Please enter a post name');
        return;
    }

    if (!description) {
        alert('Please enter a description');
        return;
    }

    if (photoUrls.length === 0 && videoUrls.length === 0) {
        alert('Please add at least one photo or video URL');
        return;
    }

    // Check cooldown - FIXED: Actually block posting during cooldown
    const canPost = await checkCooldown();
    if (!canPost) {
        const remaining = getRemainingCooldown();
        showCooldownNotification(remaining);
        return;
    }

    // Create post object
    const postData = {
        name: name,
        description: description,
        photos: photoUrls,
        videos: videoUrls,
        userId: currentUserId,
        timestamp: Date.now(),
        edited: false
    };

    // Save to Firebase
    try {
        const newPostRef = push(postsRef);
        await set(newPostRef, postData);
        
        // Set cooldown
        await set(ref(db, `userCooldowns/${currentUserId}`), Date.now());
        
        closePostPopup();
        updatePostButtonState(); // Update button state after posting
        
    } catch (error) {
        console.error('Error creating post:', error);
        alert('Failed to create post. Please try again.');
    }
}

// Cooldown system - FIXED: Actually blocks posting
async function checkCooldown() {
    try {
        const cooldownSnap = await get(ref(db, `userCooldowns/${currentUserId}`));
        const lastPostTime = cooldownSnap.val();
        
        if (lastPostTime) {
            const cooldownEnd = lastPostTime + (2 * 60 * 1000); // 2 minutes
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

// Post details
async function openPostDetails(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;

    // Load reactions
    const reactions = await getReactions(postId);

    // Update popup content
    document.getElementById('detail-post-name').textContent = post.name;
    document.getElementById('detail-post-date').textContent = formatDate(post.timestamp, true);
    document.getElementById('detail-post-description').textContent = post.description;
    
    // Show edited badge if applicable
    const editedBadge = document.getElementById('detail-edited');
    if (post.edited) {
        editedBadge.classList.remove('hidden');
    } else {
        editedBadge.classList.add('hidden');
    }

    // NEW: Add delete button for user's own posts
    const deleteButton = document.getElementById('delete-post-btn');
    if (post.userId === currentUserId) {
        deleteButton.classList.remove('hidden');
        deleteButton.onclick = () => deletePost(postId);
    } else {
        deleteButton.classList.add('hidden');
    }

    // Load media
    loadMediaGallery(post.photos, 'photos-gallery', 'photo', postId);
    loadMediaGallery(post.videos, 'videos-gallery', 'video', postId);

    // Update reactions
    updateReactionCounts(reactions);

    // Set up reaction buttons
    setupReactionButtons(postId, reactions);

    // Show popup
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

    gallery.innerHTML = mediaArray.map((url, index) => {
        if (mediaType === 'photo') {
            return `
                <div class="media-item" data-media-type="photo" data-url="${url}" data-post-id="${postId}">
                    <img src="${url}" alt="Post photo" onerror="this.style.display='none'">
                </div>
            `;
        } else {
            return `
                <div class="media-item" data-media-type="video" data-url="${url}" data-post-id="${postId}">
                    <video controls>
                        <source src="${url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        }
    }).join('');

    // Add click event for media zoom
    gallery.querySelectorAll('.media-item').forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking video controls
            if (e.target.tagName === 'VIDEO' || e.target.tagName === 'SOURCE') return;
            
            const mediaType = item.getAttribute('data-media-type');
            const url = item.getAttribute('data-url');
            openMediaZoom(url, mediaType);
        });
    });
}

// NEW: Media zoom functionality
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
        // Stop video playback
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
        
        // Set active state for user's current reaction
        if (userReaction && btn.getAttribute('data-reaction') === userReaction.type) {
            btn.classList.add('active');
        }
    });
}

async function handleReaction(postId, event) {
    const reactionType = event.currentTarget.getAttribute('data-reaction');
    const reactionRef = ref(db, `reactions/${postId}/${currentUserId}`);
    
    try {
        // If clicking the same reaction type, remove it (toggle off)
        if (currentUserReaction === reactionType) {
            await remove(reactionRef);
            currentUserReaction = null;
        } else {
            // Otherwise, set the new reaction (replaces any existing reaction)
            await set(reactionRef, {
                type: reactionType,
                timestamp: Date.now()
            });
            currentUserReaction = reactionType;
        }
        
        // Reload reactions to update counts
        const updatedReactions = await getReactions(postId);
        updateReactionCounts(updatedReactions);
        setupReactionButtons(postId, updatedReactions);
        
    } catch (error) {
        console.error('Error saving reaction:', error);
    }
}

// NEW: Delete post function
async function deletePost(postId) {
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
        return;
    }

    try {
        // Delete post
        await remove(ref(db, `posts/${postId}`));
        // Delete reactions for this post
        await remove(ref(db, `reactions/${postId}`));
        
        // Close details popup if open
        closePostDetails();
        
    } catch (error) {
        console.error('Error deleting post:', error);
        alert('Failed to delete post. Please try again.');
    }
}

// Edit post system
function openEditPopup(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post || post.userId !== currentUserId) return;

    editingPostId = postId;
    
    document.getElementById('edit-post-name').value = post.name;
    document.getElementById('edit-post-description').value = post.description;
    document.getElementById('edit-photo-urls').value = post.photos ? post.photos.join('\n') : '';
    document.getElementById('edit-video-urls').value = post.videos ? post.videos.join('\n') : '';
    updateEditCharCounters();
    
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
    const photoUrls = document.getElementById('edit-photo-urls').value.split('\n').filter(url => url.trim());
    const videoUrls = document.getElementById('edit-video-urls').value.split('\n').filter(url => url.trim());

    if (!name || !description) {
        alert('Please fill in all fields');
        return;
    }

    if (photoUrls.length === 0 && videoUrls.length === 0) {
        alert('Please add at least one photo or video URL');
        return;
    }

    try {
        await update(ref(db, `posts/${editingPostId}`), {
            name: name,
            description: description,
            photos: photoUrls,
            videos: videoUrls,
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
