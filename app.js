// Importaciones de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-ticket-app-calendar';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- ESTADO DE LA APLICACIÓN ---
let userId = null;
let ticketsCollectionRef = null;
let allTickets = [];
let currentDate = new Date();
let selectedDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// --- ELEMENTOS DEL DOM ---
const ticketsListEl = document.getElementById('tickets-list');
const loadingState = document.getElementById('loading-state');
const ticketsListTitle = document.getElementById('tickets-list-title');
const calendarGrid = document.getElementById('calendar-grid');
const monthYearEl = document.getElementById('month-year');
const addTicketForm = document.getElementById('add-ticket-form');

// --- AUTENTICACIÓN ---
onAuthStateChanged(auth, user => {
    if (user) {
        userId = user.uid;
        document.getElementById('user-id-display').textContent = `ID de Sesión: ${userId}`;
        ticketsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/tickets`);
        listenForTickets();
    }
});

async function authenticate() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch (error) {
        console.error("Error de autenticación:", error);
        document.getElementById('auth-info').textContent = "Error de autenticación.";
    }
}

// --- LÓGICA DEL CALENDARIO ---
const renderCalendar = () => {
    currentDate.setDate(1);
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    
    monthYearEl.textContent = `${currentDate.toLocaleString('es-ES', { month: 'long' })} ${year}`;
    
    const firstDayIndex = (currentDate.getDay() + 6) % 7; // Lunes = 0
    const lastDay = new Date(year, month + 1, 0).getDate();
    const prevLastDay = new Date(year, month, 0).getDate();
    
    // Limpiar grid del calendario, manteniendo los encabezados
    while (calendarGrid.children.length > 7) {
        calendarGrid.removeChild(calendarGrid.lastChild);
    }

    // Días del mes anterior
    for (let i = firstDayIndex; i > 0; i--) {
        const dayEl = document.createElement('div');
        dayEl.textContent = prevLastDay - i + 1;
        dayEl.className = 'text-gray-600 p-2';
        calendarGrid.appendChild(dayEl);
    }

    const ticketDates = new Set(allTickets.map(t => t.data().date));

    // Días del mes actual
    for (let i = 1; i <= lastDay; i++) {
        const dayEl = document.createElement('button');
        dayEl.textContent = i;
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        dayEl.dataset.date = dateStr;
        dayEl.className = 'calendar-day relative p-2 rounded-full hover:bg-gray-700 transition cursor-pointer';

        if (dateStr === selectedDate) {
            dayEl.classList.add('selected');
        }
        if(ticketDates.has(dateStr)) {
            dayEl.classList.add('has-tickets');
        }
        
        dayEl.addEventListener('click', () => {
            selectedDate = dateStr;
            document.getElementById('ticket-date').value = selectedDate;
            renderFilteredTickets();
            renderCalendar();
        });
        calendarGrid.appendChild(dayEl);
    }
};

document.getElementById('prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// --- RENDERIZADO DE TICKETS ---
const getStatusBadge = (status) => {
     switch(status) {
        case 'Desarrollo': return `<span class="bg-blue-900 text-blue-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
        case 'CEO': return `<span class="bg-purple-900 text-purple-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
        case 'Payments Way': return `<span class="bg-yellow-900 text-yellow-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
        case 'Finalizado': return `<span class="bg-green-900 text-green-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
        case 'Soporte N1': return `<span class="bg-gray-700 text-gray-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
        default: return `<span class="bg-gray-700 text-gray-300 text-xs font-medium me-2 px-2.5 py-0.5 rounded-full">${status}</span>`;
    }
};

const renderFilteredTickets = () => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    ticketsListTitle.textContent = `Tickets para el ${dateObj.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

    const filteredTickets = allTickets
        .filter(ticket => ticket.data().date === selectedDate)
        .sort((a, b) => b.data().createdAt?.toDate() - a.data().createdAt?.toDate());

    renderTickets(filteredTickets);
};

const renderTickets = (tickets) => {
    ticketsListEl.innerHTML = '';
    if (tickets.length === 0) {
        ticketsListEl.innerHTML = `<div class="text-center py-10 bg-gray-800 rounded-xl"><p class="text-gray-400">No hay tickets para esta fecha.</p></div>`;
        return;
    }

    tickets.forEach(ticket => {
        const ticketData = ticket.data();
        const ticketEl = document.createElement('div');
        ticketEl.className = 'bg-gray-800 p-5 rounded-xl shadow-md ticket-card flex flex-col md:flex-row gap-4';
        ticketEl.setAttribute('data-id', ticket.id);

        ticketEl.innerHTML = `
            <div class="flex-grow">
                <div class="flex justify-between items-start">
                     <h3 class="text-lg font-bold text-cyan-400 mb-2">${escapeHTML(ticketData.ticketId)}</h3>
                     ${getStatusBadge(ticketData.status)}
                </div>
                <p class="text-gray-300 whitespace-pre-wrap">${escapeHTML(ticketData.response)}</p>
                <p class="text-xs text-gray-500 mt-3">Registrado: ${ticketData.createdAt ? ticketData.createdAt.toDate().toLocaleString() : 'N/A'}</p>
            </div>
            <div class="flex flex-row md:flex-col items-center justify-end md:justify-start gap-2 flex-shrink-0">
                <button class="edit-btn bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full transition" title="Editar Ticket"><i class="ph ph-pencil-simple"></i></button>
                <button class="delete-btn bg-red-800 hover:bg-red-700 text-white p-2 rounded-full transition" title="Eliminar Ticket"><i class="ph ph-trash"></i></button>
            </div>
        `;
        ticketsListEl.appendChild(ticketEl);
    });
};

const escapeHTML = str => str.replace(/[&<>'"]/g, tag => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'}[tag] || tag));

// --- LÓGICA DE FIRESTORE ---
const listenForTickets = () => {
    if (!ticketsCollectionRef) return;
    const q = query(ticketsCollectionRef);
    onSnapshot(q, (querySnapshot) => {
        allTickets = querySnapshot.docs.map(doc => ({ id: doc.id, data: () => doc.data() }));
        loadingState.classList.add('hidden');
        renderCalendar();
        renderFilteredTickets();
    }, (error) => {
        console.error("Error al obtener tickets:", error);
        ticketsListEl.innerHTML = `<div class="text-center py-10"><p class="text-red-400">Error al cargar los tickets.</p></div>`;
    });
};

addTicketForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!ticketsCollectionRef) return;
    try {
        await addDoc(ticketsCollectionRef, {
            date: document.getElementById('ticket-date').value,
            ticketId: document.getElementById('ticket-id').value,
            status: document.getElementById('ticket-status').value,
            response: document.getElementById('ticket-response').value,
            createdAt: serverTimestamp()
        });
        addTicketForm.reset();
        document.getElementById('ticket-date').value = selectedDate;
    } catch (error) {
        console.error("Error al añadir el ticket: ", error);
    }
});

ticketsListEl.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const ticketEl = target.closest('.ticket-card');
    const docId = ticketEl.getAttribute('data-id');
    const ticket = allTickets.find(t => t.id === docId);

    if (target.classList.contains('delete-btn')) {
        if (confirm('¿Estás seguro de que quieres eliminar este ticket?')) {
            try {
                await deleteDoc(doc(db, ticketsCollectionRef.path, docId));
            } catch (error) {
                console.error("Error al eliminar el ticket: ", error);
            }
        }
    } else if (target.classList.contains('edit-btn')) {
        openEditModal(docId, ticket.data());
    }
});

// --- LÓGICA DEL MODAL DE EDICIÓN ---
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-ticket-form');
const cancelEditBtn = document.getElementById('cancel-edit');

const openEditModal = (docId, data) => {
    editForm.elements['edit-doc-id'].value = docId;
    editForm.elements['edit-ticket-date'].value = data.date;
    editForm.elements['edit-ticket-id'].value = data.ticketId;
    editForm.elements['edit-ticket-status'].value = data.status;
    editForm.elements['edit-ticket-response'].value = data.response;
    editModal.classList.remove('hidden');
}

const closeEditModal = () => editModal.classList.add('hidden');
cancelEditBtn.addEventListener('click', closeEditModal);

editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const docId = editForm.elements['edit-doc-id'].value;
    const docRef = doc(db, ticketsCollectionRef.path, docId);
    try {
        await updateDoc(docRef, {
            date: editForm.elements['edit-ticket-date'].value,
            ticketId: editForm.elements['edit-ticket-id'].value,
            status: editForm.elements['edit-ticket-status'].value,
            response: editForm.elements['edit-ticket-response'].value,
        });
        closeEditModal();
    } catch (error) {
        console.error("Error al actualizar el ticket:", error);
    }
});

// --- INICIALIZACIÓN ---
document.getElementById('ticket-date').value = selectedDate;
authenticate();
