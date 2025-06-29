document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');

    // --- Definisi URL dan Konstanta ---
    const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/AKfycbwW-Q1-f-ZiMsWOyulGGyx_PN632Z0_qTm2Kyuf1vZnP0TTL_0S9_8KZNhtAMDXRJ10/exec";
    const DATA_MASTER_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6ZfMabq_GxYJdxEytBTEhYeO9jHeOq_KQ6Eci7RJgzhY3ms03NFRBigw8Boo9weCuXG3628oiBgap/pub?gid=0&single=true&output=csv';
    const ROLE_MODEL_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS6ZfMabq_GxYJdxEytBTEhYeO9jHeOq_KQ6Eci7RJgzhY3ms03NFRBigw8Boo9weCuXG3628oiBgap/pub?gid=183358633&single=true&output=csv';
    const LOKASI_OPTIONS = ['Kantor', 'Toko', 'Sales', 'Kolektor'];
    const LOKASI_COLORS = {
        Kantor: 'border-blue-500 text-blue-300',
        Toko: 'border-green-500 text-green-300',
        Sales: 'border-orange-500 text-orange-300',
        Kolektor: 'border-purple-500 text-purple-300',
        '': 'border-gray-600'
    };
    
    // --- State Global Aplikasi ---
    let state = {
        isLoggedIn: false,
        loggedInCabang: null,
        masterData: [],
        filteredData: [],
        cabangList: [],
        activeFilter: '',
        searchQuery: '',
        isLoading: true,
        error: '',
    };
    
    // --- Fungsi Bantuan ---
    const formatCurrency = (value) => {
        const num = Number(String(value).replace(/[^0-9.-]+/g, ""));
        return isNaN(num) ? value : new Intl.NumberFormat('id-ID').format(num);
    };

    // --- Fungsi Render ---
    const render = () => {
        root.innerHTML = ''; // Hapus konten lama
        if (state.isLoading) {
            root.innerHTML = `<div class="flex justify-center items-center h-screen"><div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div><span class="ml-4 text-gray-400">Memuat...</span></div>`;
            return;
        }

        if (!state.isLoggedIn) {
            root.innerHTML = renderLoginScreen();
            attachLoginListeners();
        } else {
            root.innerHTML = renderMainApp();
            attachMainAppListeners();
            renderTable(); // Render tabel secara terpisah
        }
    };
    
    // --- Komponen Login ---
    const renderLoginScreen = () => {
        return `
            <div class="flex items-center justify-center min-h-screen bg-gray-900 font-sans text-gray-200">
                <div class="w-full max-w-sm p-8 space-y-6 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl">
                    <div class="text-center">
                        <h1 class="text-3xl font-bold text-white">Invoice Tracker</h1>
                        <p class="text-gray-400 mt-2">Silakan login untuk melanjutkan</p>
                    </div>
                    ${state.error ? `<div class="p-3 text-red-300 bg-red-900/50 border border-red-500/30 rounded-lg">${state.error}</div>` : ''}
                    <form id="login-form" class="space-y-6">
                        <div>
                            <label for="cabang" class="block text-sm font-medium text-gray-400">Cabang</label>
                            <select id="cabang" class="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md"></select>
                        </div>
                        <div>
                            <label for="pin" class="block text-sm font-medium text-gray-400">PIN</label>
                            <input type="password" id="pin" placeholder="••••••" class="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md" required />
                        </div>
                        <div>
                            <button type="submit" id="login-button" class="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">Login</button>
                        </div>
                    </form>
                </div>
            </div>`;
    };

    const attachLoginListeners = async () => {
        const form = document.getElementById('login-form');
        const cabangSelect = document.getElementById('cabang');
        const pinInput = document.getElementById('pin');
        const loginButton = document.getElementById('login-button');

        loginButton.disabled = true;
        cabangSelect.innerHTML = `<option>Memuat cabang...</option>`;

        try {
            const response = await fetch(ROLE_MODEL_URL);
            const csvText = await response.text();
            const parsedData = Papa.parse(csvText, { header: true }).data;
            const roles = parsedData.filter(role => role.cabang && role.cabang.trim() !== '');
            const uniqueCabang = [...new Set(roles.map(role => role.cabang))];
            
            cabangSelect.innerHTML = uniqueCabang.map(c => `<option value="${c}">${c}</option>`).join('');
            loginButton.disabled = false;

            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const selectedCabang = cabangSelect.value;
                const enteredPin = pinInput.value;
                const role = roles.find(r => r.cabang === selectedCabang);
                
                if (role && String(role.pin).trim() === String(enteredPin).trim()) {
                    handleLoginSuccess(selectedCabang);
                } else {
                    state.error = 'Cabang atau PIN tidak valid.';
                    render();
                }
            });
        } catch (e) {
            state.error = 'Tidak dapat mengambil data peran.';
            render();
        }
    };
    
    // --- Komponen Aplikasi Utama ---
    const renderMainApp = () => {
       const hasSlicerAccess = ['pusat', 'admin', 'jkt'].includes(state.loggedInCabang.toLowerCase());
        const isJKT = state.loggedInCabang.toLowerCase() === 'jkt';

        return `
            <div class="max-w-7xl mx-auto bg-gray-800 border-x border-gray-700/50 min-h-screen">
                <header class="p-4 sm:p-6 sticky top-0 bg-gray-800/80 backdrop-blur-sm z-10 border-b border-gray-700">
                    <div class="flex flex-col lg:flex-row items-center justify-between gap-4">
                        <div class="relative w-full lg:w-72">
                            <input type="text" id="search-input" placeholder="Cari Invoice atau Pelanggan..." value="${state.searchQuery}" class="w-full pl-10 pr-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-md" />
                        </div>
                        <div class="flex items-center space-x-4 w-full lg:w-auto justify-end">
                            ${hasSlicerAccess ? `
                                <select id="cabang-filter" class="p-2 bg-gray-700 text-white border border-gray-600 rounded-md">
                                    <option value="Semua">Semua Cabang</option>
                                    ${state.cabangList.map(c => `<option value="${c}" ${state.activeFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
                                </select>` : ''}
                            <button id="logout-button" class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Logout</button>
                        </div>
                    </div>
                </header>
                
                <main class="p-4 sm:p-6">
                    <div id="error-container">${state.error ? `<div class="p-4 mb-4 text-red-300 bg-red-900/50 rounded-lg">${state.error}</div>` : ''}</div>
                    <div class="overflow-x-auto" id="table-container">
                        </div>
                </main>
            </div>
        `;
    };

    const renderTable = () => {
        const tableContainer = document.getElementById('table-container');
        if (!tableContainer) return;

        let tableContent = '';
        if (state.filteredData.length > 0) {
            tableContent = state.filteredData.map(item => `
                <tr class="responsive-row bg-gray-800 hover:bg-gray-700/60">
                    <td data-label="Invoice" class="font-medium text-white">${item.invoice}</td>
                    <td data-label="Tanggal">${item.tanggal}</td>
                    <td data-label="Pelanggan">${item.pelanggan}</td>
                    <td data-label="Original Value" class="text-right">${formatCurrency(item['original value'])}</td>
                    <td data-label="Lokasi Invoice">
                        <select data-invoice="${item.invoice}" class="lokasi-select w-full p-2 text-sm text-white bg-gray-700 rounded-md ${LOKASI_COLORS[item['lokasi invoice']] || LOKASI_COLORS['']}">
                            <option value="" disabled ${!item['lokasi invoice'] ? 'selected' : ''}>Pilih Lokasi</option>
                            ${LOKASI_OPTIONS.map(opt => `<option value="${opt}" ${item['lokasi invoice'] === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>
                    </td>
                    <td data-label="Tgl Tanda Terima">
                        <input type="date" data-invoice="${item.invoice}" value="${item['tanggal tanda terima'] || ''}" class="tanggal-input w-full p-2 text-sm text-white bg-gray-700 border border-gray-600 rounded-md"/>
                    </td>
                </tr>
            `).join('');
        } else {
            tableContent = `<tr><td colspan="6" class="text-center py-16 text-gray-500">Tidak ada data untuk ditampilkan.</td></tr>`;
        }
        
        tableContainer.innerHTML = `
            <table class="w-full min-w-[700px] text-left text-gray-400 responsive-table">
                <thead>
                    <tr class="bg-gray-700">
                        <th class="p-4 text-sm font-semibold text-white">Invoice</th>
                        <th class="p-4 text-sm font-semibold text-white">Tanggal</th>
                        <th class="p-4 text-sm font-semibold text-white">Pelanggan</th>
                        <th class="p-4 text-sm font-semibold text-white text-right">Original Value</th>
                        <th class="p-4 text-sm font-semibold text-white">Lokasi Invoice</th>
                        <th class="p-4 text-sm font-semibold text-white">Tgl Tanda Terima</th>
                    </tr>
                </thead>
                <tbody>${tableContent}</tbody>
            </table>
        `;
        attachTableListeners();
    };


    const attachMainAppListeners = () => {
        document.getElementById('logout-button')?.addEventListener('click', handleLogout);
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            filterAndRenderData();
        });
        document.getElementById('cabang-filter')?.addEventListener('change', (e) => {
            state.activeFilter = e.target.value;
            filterAndRenderData();
        });
    };
    
    let saveTimeout = null;
    const attachTableListeners = () => {
        document.querySelectorAll('.lokasi-select, .tanggal-input').forEach(input => {
            input.addEventListener('change', (e) => {
                clearTimeout(saveTimeout);

                const invoice = e.target.dataset.invoice;
                const itemToUpdate = state.masterData.find(item => item.invoice === invoice);
                if (!itemToUpdate) return;
                
                // Kumpulkan data terbaru dari form
                const newLokasi = document.querySelector(`.lokasi-select[data-invoice="${invoice}"]`).value;
                const newTanggal = document.querySelector(`.tanggal-input[data-invoice="${invoice}"]`).value;

                // Siapkan data untuk disimpan
                const updatedRow = {
                    ...itemToUpdate,
                    'lokasi invoice': newLokasi,
                    'tanggal tanda terima': newTanggal,
                    'diperbarui oleh': state.loggedInCabang
                };
                
                // Update state secara optimis
                state.masterData = state.masterData.map(item => item.invoice === invoice ? updatedRow : item);
                filterAndRenderData();

                // Jadwalkan penyimpanan ke API
                saveTimeout = setTimeout(() => {
                    handleSave(updatedRow);
                }, 800);
            });
        });
    };

    // --- Logika Data ---
    const fetchAndMergeData = async () => {
        state.isLoading = true;
        render();
        try {
            const [apiResponse, csvResponse] = await Promise.all([
                fetch(GOOGLE_SHEET_API_URL),
                fetch(DATA_MASTER_CSV_URL)
            ]);
            const apiResult = await apiResponse.json();
            const csvText = await csvResponse.text();
            
            if (apiResult.status !== 'success') throw new Error('Gagal memuat data API');

            const apiData = apiResult.data;
            const masterDataFromCsv = Papa.parse(csvText, { header: true }).data.filter(d => d.invoice);
            const apiDataMap = new Map(apiData.map(item => [item.invoice, item]));
            
            state.masterData = masterDataFromCsv.map(csvItem => {
                const apiItem = apiDataMap.get(csvItem.invoice);
                return apiItem ? { ...csvItem, 'lokasi invoice': apiItem['lokasi invoice'] || '', 'tanggal tanda terima': apiItem['tanggal tanda terima'] || '' } : csvItem;
            });
            
            state.cabangList = [...new Set(state.masterData.map(item => item.cabang).filter(Boolean))];
            state.activeFilter = ['pusat', 'admin', 'jkt'].includes(state.loggedInCabang.toLowerCase()) ? 'Semua' : state.loggedInCabang;

        } catch (e) {
            state.error = e.message;
        } finally {
            state.isLoading = false;
            filterAndRenderData();
        }
    };
    
    const filterAndRenderData = () => {
        let data = state.masterData;
        const hasSlicerAccess = ['pusat', 'admin', 'jkt'].includes(state.loggedInCabang.toLowerCase());

        if (hasSlicerAccess && state.activeFilter !== 'Semua') {
            data = data.filter(item => item.cabang === state.activeFilter);
        } else if (!hasSlicerAccess) {
            data = data.filter(item => item.cabang === state.loggedInCabang);
        }

        if (state.searchQuery) {
            const lq = state.searchQuery.toLowerCase();
            data = data.filter(item => 
                (item.invoice?.toLowerCase().includes(lq)) || 
                (item.pelanggan?.toLowerCase().includes(lq))
            );
        }
        
        state.filteredData = data;
        render(); // Render ulang seluruh UI atau hanya tabel jika lebih efisien
    };

    const handleSave = async (updatedRow) => {
        try {
            await fetch(GOOGLE_SHEET_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'update', invoice: updatedRow.invoice, data: updatedRow })
            });
            // Data sudah diupdate secara optimis, tidak perlu render ulang
            console.log("Save successful for invoice:", updatedRow.invoice);
            return true;
        } catch (error) {
            console.error("Error saving data:", error);
            state.error = `Gagal menyimpan invoice ${updatedRow.invoice}. Coba lagi.`;
            render(); // Render ulang untuk menampilkan error
            return false;
        }
    };

    // --- Handler Aksi Pengguna ---
    const handleLoginSuccess = (cabang) => {
        state.isLoggedIn = true;
        state.loggedInCabang = cabang;
        state.error = '';
        fetchAndMergeData();
    };

    const handleLogout = () => {
        state = { ...state, isLoggedIn: false, loggedInCabang: null, masterData: [], filteredData: [] };
        render();
    };

    // --- Inisialisasi Aplikasi ---
    render();
});
