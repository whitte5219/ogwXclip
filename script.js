import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
    getDatabase, 
    ref, 
    push, 
    set, 
    get, 
    update, 
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

// Filter controls - FIXED: Now properly hidden by default
function toggleFilters() {
    filtersPanel.classList.toggle('hidden');
}

function applyFilters() {
    performSearch();
    filtersPanel.classList.add('hidden');
}

// Post creation
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

    // Check cooldown
    const canPost = await checkCooldown();
    if (!canPost) return;

    // Create post object
    const postData = {
        name: name,
        description: description,
        photos: photoUrls,
        videos: videoUrls,
        userId: currentUserId,
        timestamp: Date.now(),
        edited: false // FIXED: Always set to false initially
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

// Cooldown system - FIXED: Now properly blocks post button and shows countdown
async function checkCooldown() {
    try {
        const cooldownSnap = await get(ref(db, `userCooldowns/${currentUserId}`));
        const lastPostTime = cooldownSnap.val();
        
        if (lastPostTime) {
            const cooldownEnd = lastPostTime + (2 * 60 * 1000); // 2 minutes
            if (Date.now() < cooldownEnd) {
                const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
                showCooldownNotification(remaining);
                return false;
            }
        }
        return true;
    } catch (error) {
        console.error('Error checking cooldown:', error);
        return true;
    }
}

function updatePostButtonState() {
    get(ref(db, `userCooldowns/${currentUserId}`)).then((cooldownSnap) => {
        const lastPostTime = cooldownSnap.val();
        
        if (lastPostTime) {
            const cooldownEnd = lastPostTime + (2 * 60 * 1000);
            const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
            
            if (remaining > 0) {
                // Still in cooldown
                postBtn.classList.add('disabled');
                postBtn.style.pointerEvents = 'none';
                startCooldownTimer(remaining);
            } else {
                // Cooldown finished
                postBtn.classList.remove('disabled');
                postBtn.style.pointerEvents = 'auto';
                postBtn.innerHTML = 'Post';
                if (cooldownInterval) {
                    clearInterval(cooldownInterval);
                    cooldownInterval = null;
                }
                cooldownNotification.classList.add('hidden');
            }
        } else {
            // No cooldown
            postBtn.classList.remove('disabled');
            postBtn.style.pointerEvents = 'auto';
            postBtn.innerHTML = 'Post';
            cooldownNotification.classList.add('hidden');
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
    
    // Show edited badge if applicable - FIXED: Only show if post was actually edited
    const editedBadge = document.getElementById('detail-edited');
    if (post.edited) {
        editedBadge.classList.remove('hidden');
    } else {
        editedBadge.classList.add('hidden');
    }

    // Load media
    loadMediaGallery(post.photos, 'photos-gallery', 'photo');
    loadMediaGallery(post.videos, 'videos-gallery', 'video');

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

function loadMediaGallery(mediaArray, galleryId, mediaType) {
    const gallery = document.getElementById(galleryId);
    
    if (!mediaArray || mediaArray.length === 0) {
        gallery.innerHTML = `<p style="color: var(--text-secondary); text-align: center;">No ${mediaType}s available</p>`;
        return;
    }

    gallery.innerHTML = mediaArray.map(url => {
        if (mediaType === 'photo') {
            return `<div class="media-item"><img src="${url}" alt="Post photo" onerror="this.style.display='none'"></div>`;
        } else {
            return `
                <div class="media-item">
                    <video controls>
                        <source src="${url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        }
    }).join('');
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
    
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.addEventListener('click', (e) => handleReaction(postId, e));
        
        // Set active state for user's current reaction
        if (userReaction && btn.getAttribute('data-reaction') === userReaction.type) {
            btn.classList.add('active');
        }
    });
}

async function handleReaction(postId, event) {
    const reactionType = event.currentTarget.getAttribute('data-reaction');
    
    try {
        await set(ref(db, `reactions/${postId}/${currentUserId}`), {
            type: reactionType,
            timestamp: Date.now()
        });
        
        // Reload reactions to update counts
        const updatedReactions = await getReactions(postId);
        updateReactionCounts(updatedReactions);
        setupReactionButtons(postId, updatedReactions);
        
    } catch (error) {
        console.error('Error saving reaction:', error);
    }
}

// Edit post system
function openEditPopup(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post || post.userId !== currentUserId) return;

    editingPostId = postId;
    
    document.getElementById('edit-post-name').value = post.name;
    document.getElementById('edit-post-description').value = post.description;
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

    if (!name || !description) {
        alert('Please fill in all fields');
        return;
    }

    try {
        await update(ref(db, `posts/${editingPostId}`), {
            name: name,
            description: description,
            edited: true // FIXED: Only set to true when actually edited
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
