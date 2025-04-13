document.addEventListener('DOMContentLoaded', function() {
    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const sections = {
        home: document.getElementById('home-section'),
        teachers: document.getElementById('teachers-section'),
        appointments: document.getElementById('appointments-section'),
        login: document.getElementById('login-section'),
        register: document.getElementById('register-section'),
        admin: document.getElementById('admin-section'),
        teacherDashboard: document.getElementById('teacher-dashboard-section')
    };

    // Initialize Flatpickr for date/time picking
    flatpickr("#appointment-date", {
        enableTime: false,
        dateFormat: "Y-m-d",
        minDate: "today"
    });

    flatpickr("#appointment-time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true
    });

    // User state management
    let currentUser = null;
    let userRole = null;
    let isAdmin = false;
    let isTeacher = false;

    // Initialize the application
    function init() {
        setupEventListeners();
        checkAuthState();
    }

    // Event Listeners setup
    function setupEventListeners() {
        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = e.target.getAttribute('data-target');
                showSection(target);
            });
        });

        // Form submissions
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        document.getElementById('register-form').addEventListener('submit', handleRegister);
        document.getElementById('appointment-form').addEventListener('submit', handleAppointmentBooking);
        document.getElementById('add-teacher-form').addEventListener('submit', handleAddTeacher);
        document.getElementById('availability-form').addEventListener('submit', handleAvailabilityUpdate);

        // Teacher dashboard buttons
        document.getElementById('refresh-appointments').addEventListener('click', loadTeacherAppointments);
    }

    // Auth state check
    function checkAuthState() {
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                checkUserRole(user.uid);
            } else {
                resetAuthState();
                showSection('home');
            }
        });
    }

    // Check user role from Firestore
    function checkUserRole(uid) {
        db.collection('users').doc(uid).get().then(doc => {
            if (doc.exists) {
                userRole = doc.data().role;
                isAdmin = userRole === 'admin';
                isTeacher = userRole === 'teacher';
                updateUI();
                loadDashboard();
            } else {
                createUserDocument(uid);
            }
        }).catch(error => showError('Error checking user role:', error));
    }

    // Create user document if not exists
    function createUserDocument(uid) {
        db.collection('users').doc(uid).set({
            role: 'student',
            email: currentUser.email,
            name: currentUser.displayName || ''
        }).then(() => {
            userRole = 'student';
            updateUI();
            loadDashboard();
        }).catch(error => showError('Error creating user:', error));
    }

    // Update UI based on user role
    function updateUI() {
        const teacherDashboardLink = document.getElementById('teacher-dashboard-link');
        const adminLink = document.getElementById('admin-link');
        
        teacherDashboardLink.style.display = isTeacher ? 'block' : 'none';
        adminLink.style.display = isAdmin ? 'block' : 'none';
    }

    // Show specific section
    function showSection(sectionId) {
        Object.values(sections).forEach(section => section.style.display = 'none');
        document.getElementById(sectionId).style.display = 'block';
        if (sectionId === 'teachers') loadAllTeachers();
        if (sectionId === 'appointments') loadUserAppointments();
        if (sectionId === 'teacher-dashboard') loadTeacherAppointments();
    }

    // Load appropriate dashboard
    function loadDashboard() {
        if (isAdmin) showSection('admin');
        else if (isTeacher) showSection('teacher-dashboard');
        else showSection('home');
    }

    // Handle login
    function handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        auth.signInWithEmailAndPassword(email, password)
            .then(() => showSuccess('Logged in successfully'))
            .catch(error => showError('Login failed:', error));
    }

    // Handle registration
    function handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const name = document.getElementById('register-name').value;
        const role = document.getElementById('register-role').value;

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => createUserDocument(userCredential.user.uid, name, role))
            .then(() => showSuccess('Registration successful!'))
            .catch(error => showError('Registration failed:', error));
    }

    // Handle appointment booking with conflict check
    function handleAppointmentBooking(e) {
        e.preventDefault();
        const teacherId = document.getElementById('appointment-teacher-id').value;
        const date = document.getElementById('appointment-date').value;
        const time = document.getElementById('appointment-time').value;

        checkAppointmentConflict(teacherId, date, time)
            .then(isConflict => {
                if (isConflict) throw new Error('Time slot already booked');
                return db.collection('appointments').add({
                    teacherId,
                    studentId: currentUser.uid,
                    date,
                    time,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            })
            .then(() => showSuccess('Appointment booked!'))
            .catch(error => showError('Booking failed:', error));
    }

    // Check for appointment conflicts
    function checkAppointmentConflict(teacherId, date, time) {
        return db.collection('appointments')
            .where('teacherId', '==', teacherId)
            .where('date', '==', date)
            .where('time', '==', time)
            .get()
            .then(snapshot => !snapshot.empty);
    }

    // Load teacher-specific appointments
    function loadTeacherAppointments() {
        db.collection('appointments')
            .where('teacherId', '==', currentUser.uid)
            .get()
            .then(snapshot => {
                const appointmentsList = document.getElementById('teacher-appointments-list');
                appointmentsList.innerHTML = snapshot.docs.map(doc => `
                    <div class="appointment-card">
                        <p>Date: ${doc.data().date}</p>
                        <p>Time: ${doc.data().time}</p>
                        <p>Student: ${doc.data().studentEmail}</p>
                        <button onclick="updateAppointmentStatus('${doc.id}', 'approved')">Approve</button>
                        <button onclick="updateAppointmentStatus('${doc.id}', 'rejected')">Reject</button>
                    </div>
                `).join('');
            })
            .catch(error => showError('Loading appointments failed:', error));
    }

    // Update appointment status
    function updateAppointmentStatus(appointmentId, status) {
        db.collection('appointments').doc(appointmentId).update({ status })
            .then(() => showSuccess('Appointment updated!'))
            .catch(error => showError('Update failed:', error));
    }

    // Utility functions
    function showSuccess(message) {
        Toastify({ text: message, backgroundColor: "#28a745" }).showToast();
    }

    function showError(context, error) {
        console.error(context, error);
        Toastify({ text: `${error.message}`, backgroundColor: "#dc3545" }).showToast();
    }

    // Initialize the app
    init();
});