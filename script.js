document.addEventListener('DOMContentLoaded', function() {
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const mainContent = document.getElementById('main-content');
    const homeSection = document.getElementById('home-section');
    const loginSection = document.getElementById('login-section');
    const registerSection = document.getElementById('register-section');
    const teachersSection = document.getElementById('teachers-section');
    const appointmentsSection = document.getElementById('appointments-section');
    const adminSection = document.getElementById('admin-section');
    
    const homeLink = document.getElementById('home-link');
    const teachersLink = document.getElementById('teachers-link');
    const appointmentsLink = document.getElementById('appointments-link');
    const loginLink = document.getElementById('login-link');
    const registerLink = document.getElementById('register-link');
    const logoutLink = document.getElementById('logout-link');
    const adminLink = document.getElementById('admin-link');
    const adminDivider = document.getElementById('admin-divider');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const appointmentForm = document.getElementById('appointment-form');
    const addTeacherForm = document.getElementById('add-teacher-form');
    
    const teacherModal = new bootstrap.Modal(document.getElementById('teacherModal'));
    const addTeacherModal = new bootstrap.Modal(document.getElementById('addTeacherModal'));
    
    // User state
    let currentUser = null;
    let userRole = null;
    let isAdmin = false;

    // Initialize the application
    function init() {
        setupEventListeners();
        checkAuthState();
    }

    function setupEventListeners() {
        // Navigation links
        homeLink.addEventListener('click', showHome);
        teachersLink.addEventListener('click', showTeachers);
        appointmentsLink.addEventListener('click', showAppointments);
        loginLink.addEventListener('click', showLogin);
        registerLink.addEventListener('click', showRegister);
        logoutLink.addEventListener('click', handleLogout);
        adminLink.addEventListener('click', showAdmin);
        
        // Form submissions
        loginForm.addEventListener('submit', handleLogin);
        registerForm.addEventListener('submit', handleRegister);
        appointmentForm.addEventListener('submit', handleAppointmentBooking);
        addTeacherForm.addEventListener('submit', handleAddTeacher);
        
        // Other interactive elements
        document.getElementById('find-teacher-btn').addEventListener('click', showTeachers);
        document.getElementById('book-appointment-btn').addEventListener('click', () => {
            if (currentUser) {
                showAppointments();
            } else {
                showLogin();
            }
        });
        document.getElementById('login-from-register-link').addEventListener('click', showLogin);
        document.getElementById('teacher-search-btn').addEventListener('click', searchTeachers);
        document.getElementById('teacher-search').addEventListener('keyup', function(e) {
            if (e.key === 'Enter') searchTeachers();
        });
    }

    function checkAuthState() {
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                checkUserRole(user.uid);
            } else {
                currentUser = null;
                userRole = null;
                isAdmin = false;
                updateUI();
                showHome();
            }
        });
    }

    function checkUserRole(uid) {
        db.collection('users').doc(uid).get()
            .then(doc => {
                if (doc.exists) {
                    userRole = doc.data().role;
                    isAdmin = userRole === 'admin';
                    updateUI();
                    showHome();
                } else {
                    // User document doesn't exist, create one
                    db.collection('users').doc(uid).set({
                        role: 'student',
                        email: currentUser.email,
                        name: currentUser.displayName || ''
                    })
                    .then(() => {
                        userRole = 'student';
                        isAdmin = false;
                        updateUI();
                        showHome();
                    });
                }
            })
            .catch(error => {
                console.error("Error checking user role:", error);
                showAlert('danger', 'Error checking your account status');
            });
    }

    function updateUI() {
        // Show/hide elements based on auth state
        if (currentUser) {
            loginLink.style.display = 'none';
            registerLink.style.display = 'none';
            logoutLink.style.display = 'block';
            
            // Show admin links if user is admin
            if (isAdmin) {
                adminLink.style.display = 'block';
                adminDivider.style.display = 'block';
            } else {
                adminLink.style.display = 'none';
                adminDivider.style.display = 'none';
            }
            
            // Update user display
            const userDisplay = document.getElementById('user-display');
            if (userDisplay) {
                userDisplay.textContent = `Welcome, ${currentUser.email}`;
            }
        } else {
            loginLink.style.display = 'block';
            registerLink.style.display = 'block';
            logoutLink.style.display = 'none';
            adminLink.style.display = 'none';
            adminDivider.style.display = 'none';
        }
    }

    // Section navigation functions
    function showHome() {
        hideAllSections();
        homeSection.style.display = 'block';
        loadFeaturedTeachers();
    }

    function showTeachers() {
        hideAllSections();
        teachersSection.style.display = 'block';
        loadAllTeachers();
    }

    function showAppointments() {
        hideAllSections();
        appointmentsSection.style.display = 'block';
        if (currentUser) {
            loadUserAppointments();
        }
    }

    function showLogin() {
        hideAllSections();
        loginSection.style.display = 'block';
        loginForm.reset();
    }

    function showRegister() {
        hideAllSections();
        registerSection.style.display = 'block';
        registerForm.reset();
    }

    function showAdmin() {
        if (!isAdmin) return;
        hideAllSections();
        adminSection.style.display = 'block';
        loadAllUsers();
        loadAllAppointments();
    }

    function hideAllSections() {
        const sections = [homeSection, teachersSection, appointmentsSection, 
                         loginSection, registerSection, adminSection];
        sections.forEach(section => {
            section.style.display = 'none';
        });
    }

    // Auth handlers
    function handleLogin(e) {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;
        
        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                showAlert('success', 'Logged in successfully');
                showHome();
            })
            .catch(error => {
                console.error("Login error:", error);
                showAlert('danger', error.message);
            });
    }

    function handleRegister(e) {
        e.preventDefault();
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        const name = registerForm['register-name'].value;
        const role = registerForm['register-role'].value;
        
        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                // Create user document in Firestore
                return db.collection('users').doc(userCredential.user.uid).set({
                    name: name,
                    email: email,
                    role: role
                });
            })
            .then(() => {
                showAlert('success', 'Registration successful!');
                showLogin();
            })
            .catch(error => {
                console.error("Registration error:", error);
                showAlert('danger', error.message);
            });
    }

    function handleLogout() {
        auth.signOut()
            .then(() => {
                showAlert('success', 'Logged out successfully');
                showHome();
            })
            .catch(error => {
                console.error("Logout error:", error);
                showAlert('danger', error.message);
            });
    }

    // Data functions
    function loadFeaturedTeachers() {
        const featuredContainer = document.getElementById('featured-teachers');
        featuredContainer.innerHTML = '<div class="text-center">Loading teachers...</div>';
        
        db.collection('teachers').limit(3).get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    featuredContainer.innerHTML = '<div class="alert alert-info">No featured teachers available</div>';
                    return;
                }
                
                featuredContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const teacher = doc.data();
                    featuredContainer.appendChild(createTeacherCard(doc.id, teacher));
                });
            })
            .catch(error => {
                console.error("Error loading teachers:", error);
                featuredContainer.innerHTML = '<div class="alert alert-danger">Error loading teachers</div>';
            });
    }

    function loadAllTeachers() {
        const teachersContainer = document.getElementById('teachers-list');
        teachersContainer.innerHTML = '<div class="text-center">Loading teachers...</div>';
        
        db.collection('teachers').get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    teachersContainer.innerHTML = '<div class="alert alert-info">No teachers available</div>';
                    return;
                }
                
                teachersContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const teacher = doc.data();
                    teachersContainer.appendChild(createTeacherCard(doc.id, teacher, true));
                });
            })
            .catch(error => {
                console.error("Error loading teachers:", error);
                teachersContainer.innerHTML = '<div class="alert alert-danger">Error loading teachers</div>';
            });
    }

    function searchTeachers() {
        const searchTerm = document.getElementById('teacher-search').value.toLowerCase();
        const teachersContainer = document.getElementById('teachers-list');
        teachersContainer.innerHTML = '<div class="text-center">Searching teachers...</div>';
        
        db.collection('teachers').get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    teachersContainer.innerHTML = '<div class="alert alert-info">No teachers match your search</div>';
                    return;
                }
                
                teachersContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const teacher = doc.data();
                    if (teacher.name.toLowerCase().includes(searchTerm) || 
                        teacher.specialty.toLowerCase().includes(searchTerm)) {
                        teachersContainer.appendChild(createTeacherCard(doc.id, teacher, true));
                    }
                });
                
                if (teachersContainer.children.length === 0) {
                    teachersContainer.innerHTML = '<div class="alert alert-info">No teachers match your search</div>';
                }
            })
            .catch(error => {
                console.error("Error searching teachers:", error);
                teachersContainer.innerHTML = '<div class="alert alert-danger">Error searching teachers</div>';
            });
    }

    function loadUserAppointments() {
        const appointmentsContainer = document.getElementById('appointments-list');
        appointmentsContainer.innerHTML = '<div class="text-center">Loading appointments...</div>';
        
        db.collection('appointments')
            .where('studentId', '==', currentUser.uid)
            .get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    appointmentsContainer.innerHTML = '<div class="alert alert-info">You have no appointments</div>';
                    return;
                }
                
                appointmentsContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const appointment = doc.data();
                    appointmentsContainer.appendChild(createAppointmentCard(doc.id, appointment));
                });
            })
            .catch(error => {
                console.error("Error loading appointments:", error);
                appointmentsContainer.innerHTML = '<div class="alert alert-danger">Error loading appointments</div>';
            });
    }

    function loadAllAppointments() {
        if (!isAdmin) return;
        
        const appointmentsContainer = document.getElementById('admin-appointments-list');
        appointmentsContainer.innerHTML = '<div class="text-center">Loading all appointments...</div>';
        
        db.collection('appointments').get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    appointmentsContainer.innerHTML = '<div class="alert alert-info">No appointments found</div>';
                    return;
                }
                
                appointmentsContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const appointment = doc.data();
                    appointmentsContainer.appendChild(createAdminAppointmentCard(doc.id, appointment));
                });
            })
            .catch(error => {
                console.error("Error loading appointments:", error);
                appointmentsContainer.innerHTML = '<div class="alert alert-danger">Error loading appointments</div>';
            });
    }

    function loadAllUsers() {
        if (!isAdmin) return;
        
        const usersContainer = document.getElementById('admin-users-list');
        usersContainer.innerHTML = '<div class="text-center">Loading users...</div>';
        
        db.collection('users').get()
            .then(querySnapshot => {
                if (querySnapshot.empty) {
                    usersContainer.innerHTML = '<div class="alert alert-info">No users found</div>';
                    return;
                }
                
                usersContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const user = doc.data();
                    usersContainer.appendChild(createUserCard(doc.id, user));
                });
            })
            .catch(error => {
                console.error("Error loading users:", error);
                usersContainer.innerHTML = '<div class="alert alert-danger">Error loading users</div>';
            });
    }

    // Form handlers
    function handleAppointmentBooking(e) {
        e.preventDefault();
        if (!currentUser) {
            showAlert('danger', 'Please login to book appointments');
            showLogin();
            return;
        }
        
        const teacherId = appointmentForm['appointment-teacher-id'].value;
        const date = appointmentForm['appointment-date'].value;
        const time = appointmentForm['appointment-time'].value;
        const notes = appointmentForm['appointment-notes'].value;
        
        db.collection('appointments').add({
            teacherId: teacherId,
            studentId: currentUser.uid,
            studentEmail: currentUser.email,
            date: date,
            time: time,
            notes: notes,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            showAlert('success', 'Appointment booked successfully!');
            appointmentForm.reset();
            loadUserAppointments();
        })
        .catch(error => {
            console.error("Error booking appointment:", error);
            showAlert('danger', error.message);
        });
    }

    function handleAddTeacher(e) {
        e.preventDefault();
        if (!isAdmin) return;
        
        const name = addTeacherForm['teacher-name'].value;
        const specialty = addTeacherForm['teacher-specialty'].value;
        const bio = addTeacherForm['teacher-bio'].value;
        const image = addTeacherForm['teacher-image'].value || 'https://via.placeholder.com/150';
        
        db.collection('teachers').add({
            name: name,
            specialty: specialty,
            bio: bio,
            image: image,
            rating: 0,
            reviews: 0
        })
        .then(() => {
            showAlert('success', 'Teacher added successfully!');
            addTeacherForm.reset();
            addTeacherModal.hide();
            loadAllTeachers();
        })
        .catch(error => {
            console.error("Error adding teacher:", error);
            showAlert('danger', error.message);
        });
    }

    // UI helper functions
    function createTeacherCard(id, teacher, showBookButton = false) {
        const card = document.createElement('div');
        card.className = 'col-md-4 mb-4';
        card.innerHTML = `
            <div class="card h-100">
                <img src="${teacher.image}" class="card-img-top" alt="${teacher.name}">
                <div class="card-body">
                    <h5 class="card-title">${teacher.name}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${teacher.specialty}</h6>
                    <p class="card-text">${teacher.bio}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <span class="badge bg-primary">Rating: ${teacher.rating || 'N/A'}</span>
                        ${showBookButton ? `<button class="btn btn-sm btn-success book-teacher-btn" data-teacher-id="${id}" data-teacher-name="${teacher.name}">Book Appointment</button>` : ''}
                    </div>
                </div>
            </div>
        `;
        
        if (showBookButton) {
            card.querySelector('.book-teacher-btn').addEventListener('click', function() {
                document.getElementById('appointment-teacher-name').value = this.dataset.teacherName;
                document.getElementById('appointment-teacher-id').value = this.dataset.teacherId;
                showAppointments();
            });
        }
        
        return card;
    }

    function createAppointmentCard(id, appointment) {
        return createCard(`
            <h5>Appointment with ${appointment.teacherName || 'Teacher'}</h5>
            <p><strong>Date:</strong> ${appointment.date}</p>
            <p><strong>Time:</strong> ${appointment.time}</p>
            <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(appointment.status)}">${appointment.status}</span></p>
            ${appointment.notes ? `<p><strong>Notes:</strong> ${appointment.notes}</p>` : ''}
            <button class="btn btn-sm btn-danger cancel-appointment-btn" data-appointment-id="${id}">Cancel</button>
        `, function() {
            this.querySelector('.cancel-appointment-btn').addEventListener('click', function() {
                cancelAppointment(this.dataset.appointmentId);
            });
        });
    }

    function createAdminAppointmentCard(id, appointment) {
        return createCard(`
            <h5>Appointment</h5>
            <p><strong>Teacher:</strong> ${appointment.teacherName || 'N/A'}</p>
            <p><strong>Student:</strong> ${appointment.studentEmail}</p>
            <p><strong>Date:</strong> ${appointment.date}</p>
            <p><strong>Time:</strong> ${appointment.time}</p>
            <p><strong>Status:</strong> <span class="badge ${getStatusBadgeClass(appointment.status)}">${appointment.status}</span></p>
            <div class="btn-group">
                <button class="btn btn-sm btn-success approve-appointment-btn" data-appointment-id="${id}">Approve</button>
                <button class="btn btn-sm btn-danger reject-appointment-btn" data-appointment-id="${id}">Reject</button>
            </div>
        `, function() {
            this.querySelector('.approve-appointment-btn').addEventListener('click', function() {
                updateAppointmentStatus(this.dataset.appointmentId, 'approved');
            });
            this.querySelector('.reject-appointment-btn').addEventListener('click', function() {
                updateAppointmentStatus(this.dataset.appointmentId, 'rejected');
            });
        });
    }

    function createUserCard(id, user) {
        return createCard(`
            <h5>${user.name || 'User'}</h5>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Role:</strong> <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${user.role}</span></p>
            ${user.role !== 'admin' ? `<button class="btn btn-sm btn-warning make-admin-btn" data-user-id="${id}">Make Admin</button>` : ''}
        `, function() {
            if (this.querySelector('.make-admin-btn')) {
                this.querySelector('.make-admin-btn').addEventListener('click', function() {
                    makeAdmin(this.dataset.userId);
                });
            }
        });
    }

    function createCard(content, setupCallback = null) {
        const card = document.createElement('div');
        card.className = 'col-md-6 mb-3';
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    ${content}
                </div>
            </div>
        `;
        if (setupCallback) setupCallback.call(card);
        return card;
    }

    // Data modification functions
    function cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) return;
        
        db.collection('appointments').doc(appointmentId).update({
            status: 'cancelled'
        })
        .then(() => {
            showAlert('success', 'Appointment cancelled');
            loadUserAppointments();
        })
        .catch(error => {
            console.error("Error cancelling appointment:", error);
            showAlert('danger', error.message);
        });
    }

    function updateAppointmentStatus(appointmentId, status) {
        db.collection('appointments').doc(appointmentId).update({
            status: status
        })
        .then(() => {
            showAlert('success', `Appointment ${status}`);
            loadAllAppointments();
        })
        .catch(error => {
            console.error("Error updating appointment:", error);
            showAlert('danger', error.message);
        });
    }

    function makeAdmin(userId) {
        if (!confirm('Are you sure you want to make this user an admin?')) return;
        
        db.collection('users').doc(userId).update({
            role: 'admin'
        })
        .then(() => {
            showAlert('success', 'User is now an admin');
            loadAllUsers();
        })
        .catch(error => {
            console.error("Error making user admin:", error);
            showAlert('danger', error.message);
        });
    }

    // Utility functions
    function showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        const alertsContainer = document.getElementById('alerts-container') || document.body;
        alertsContainer.prepend(alertDiv);
        
        setTimeout(() => {
            alertDiv.classList.remove('show');
            setTimeout(() => alertDiv.remove(), 150);
        }, 5000);
    }

    function getStatusBadgeClass(status) {
        switch(status) {
            case 'approved': return 'bg-success';
            case 'pending': return 'bg-warning text-dark';
            case 'rejected': 
            case 'cancelled': return 'bg-danger';
            default: return 'bg-secondary';
        }
    }

    // Initialize the app
    init();
});