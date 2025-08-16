// main.js

document.addEventListener('DOMContentLoaded', () => {
    // Referensi Elemen DOM
    const transactionForm = document.getElementById('transaction-form');
    const transactionList = document.getElementById('transaction-list');
    const accountBalancesContainer = document.getElementById('account-balances');
    const totalTabunganEl = document.getElementById('total-tabungan');
    const modalBisnisEl = document.getElementById('modal-bisnis');
    const uangFoyaEl = document.getElementById('uang-foya');
    const filterBulan = document.getElementById('filter-bulan');
    const filterTahun = document.getElementById('filter-tahun');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportPdfBtn = document.getElementById('export-pdf');
    const modePribadiBtn = document.getElementById('mode-pribadi');
    const modeBisnisBtn = document.getElementById('mode-bisnis');
    
    // State Aplikasi
    let transactions = JSON.parse(localStorage.getItem('transactions_v3')) || [];
    let currentMode = 'pribadi';
    const accountList = ['GoPay', 'BRI', 'SeaBank', 'Bibit', 'Bank Jago', 'DANA', 'Cash'];

    // Inisialisasi
    const init = () => {
        setupEventListeners();
        populateDate();
        populateFilters();
        renderAll();
    };

    const setupEventListeners = () => {
        transactionForm.addEventListener('submit', addTransaction);
        filterBulan.addEventListener('change', renderAll);
        filterTahun.addEventListener('change', renderAll);
        exportCsvBtn.addEventListener('click', exportCSV);
        exportPdfBtn.addEventListener('click', exportPDF);
        modePribadiBtn.addEventListener('click', () => setMode('pribadi'));
        modeBisnisBtn.addEventListener('click', () => setMode('bisnis'));
    };

    // Fungsi Utama
    const addTransaction = (e) => {
        e.preventDefault();
        
        const formData = new FormData(transactionForm);
        const amount = parseFloat(formData.get('jumlah'));
        const keterangan = formData.get('keterangan').trim();

        const baseTransaction = {
            id: Date.now(),
            akun: formData.get('akun'),
            jenis: formData.get('jenis'),
            jumlah: amount,
            keterangan: keterangan,
            tanggal: formData.get('tanggal'),
        };
        
        // Auto-split jika jenis pemasukan DAN keterangan mengandung kata "bisnis"
        if (baseTransaction.jenis === 'pemasukan' && keterangan.toLowerCase().includes('bisnis')) {
            transactions.push({ ...baseTransaction, akun: 'Bank Jago' });
            handleBusinessSplit(baseTransaction);
        } else {
            transactions.push(baseTransaction);
        }

        saveTransactions();
        renderAll();
        transactionForm.reset();
        populateDate();
    };

    const handleBusinessSplit = (baseTransaction) => {
        const amount = baseTransaction.jumlah;
        const tabunganAmount = amount * 0.3;
        const foyaAmount = amount * 0.2;

        const splitTransactions = [
            { id: Date.now() + 1, akun: 'Bank Jago', jenis: 'pengeluaran', jumlah: tabunganAmount, keterangan: `Split Tabungan dari: ${baseTransaction.keterangan}`, tanggal: baseTransaction.tanggal },
            { id: Date.now() + 2, akun: 'Bank Jago', jenis: 'pengeluaran', jumlah: foyaAmount, keterangan: `Split Foya dari: ${baseTransaction.keterangan}`, tanggal: baseTransaction.tanggal },
            { id: Date.now() + 3, akun: 'SeaBank', jenis: 'pemasukan', jumlah: tabunganAmount, keterangan: `Split Tabungan dari: ${baseTransaction.keterangan}`, tanggal: baseTransaction.tanggal },
            { id: Date.now() + 4, akun: 'DANA', jenis: 'pemasukan', jumlah: foyaAmount, keterangan: `Split Foya dari: ${baseTransaction.keterangan}`, tanggal: baseTransaction.tanggal }
        ];
        
        transactions.push(...splitTransactions);
    };

    const saveTransactions = () => {
        localStorage.setItem('transactions_v3', JSON.stringify(transactions));
    };
    
    const setMode = (mode) => {
        currentMode = mode;
        modePribadiBtn.classList.toggle('bg-white', mode === 'pribadi');
        modePribadiBtn.classList.toggle('shadow', mode === 'pribadi');
        modeBisnisBtn.classList.toggle('bg-white', mode === 'bisnis');
        modeBisnisBtn.classList.toggle('shadow', mode === 'bisnis');
        renderAll();
    };

    // Fungsi Render
    const renderAll = () => {
        const filtered = getFilteredTransactions();
        renderBalances(transactions);
        renderSummary(transactions);
        renderTransactionHistory(filtered);
    };

    const getFilteredTransactions = () => {
        const selectedBulan = filterBulan.value;
        const selectedTahun = filterTahun.value;
        
        return transactions.filter(t => {
            const date = new Date(t.tanggal);
            const bulanMatch = selectedBulan === 'all' || (date.getMonth() + 1) == selectedBulan;
            const tahunMatch = selectedTahun === 'all' || date.getFullYear() == selectedTahun;
            
            // Filter mode berdasarkan keterangan
            const isBusinessTx = t.keterangan.toLowerCase().includes('bisnis');
            const modeMatch = currentMode === 'bisnis' ? isBusinessTx : !isBusinessTx;
            
            return bulanMatch && tahunMatch && modeMatch;
        });
    };

    const renderBalances = (allTransactions) => {
        const balances = accountList.reduce((acc, account) => ({ ...acc, [account]: 0 }), {});

        allTransactions.forEach(t => {
            if (balances[t.akun] !== undefined) {
                balances[t.akun] += t.jenis === 'pemasukan' ? t.jumlah : -t.jumlah;
            }
        });
        
        accountBalancesContainer.innerHTML = '';
        accountList.forEach(account => {
            const balance = balances[account] || 0;
            const div = document.createElement('div');
            div.className = 'p-3 rounded-lg border border-slate-200';
            div.innerHTML = `
                <div class="text-sm text-slate-500">${account}</div>
                <div class="font-bold text-lg ${balance < 0 ? 'text-red-600' : 'text-slate-800'}">${formatCurrency(balance)}</div>
            `;
            accountBalancesContainer.appendChild(div);
        });

        window.currentBalances = balances;
    };
    
    const renderSummary = () => {
        const balances = window.currentBalances || {};
        const getCashBalance = (keyword) => transactions
            .filter(t => t.akun === 'Cash' && t.keterangan.toLowerCase().includes(keyword))
            .reduce((sum, t) => sum + (t.jenis === 'pemasukan' ? t.jumlah : -t.jumlah), 0);

        const tabungan = (balances['SeaBank'] || 0) + (balances['Bibit'] || 0) + getCashBalance('tabungan');
        const modal = balances['Bank Jago'] || 0;
        const foya = (balances['DANA'] || 0) + getCashBalance('foya');

        totalTabunganEl.textContent = formatCurrency(tabungan);
        modalBisnisEl.textContent = formatCurrency(modal);
        uangFoyaEl.textContent = formatCurrency(foya);
    };

    const renderTransactionHistory = (filtered) => {
        transactionList.innerHTML = '';
        if (filtered.length === 0) {
            transactionList.innerHTML = `<tr><td colspan="2" class="text-center p-4 text-slate-500">Belum ada transaksi untuk filter ini.</td></tr>`;
            return;
        }

        filtered.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal) || b.id - a.id);
        
        filtered.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-200 hover:bg-slate-50 new-item-mobile';
            const isIncome = t.jenis === 'pemasukan';
            
            tr.innerHTML = `
                <td class="p-3">
                    <div class="font-medium">${t.keterangan}</div>
                    <div class="text-xs text-slate-500">
                        <span>${new Date(t.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric'})}</span> &bull;
                        <span>${t.akun}</span>
                    </div>
                </td>
                <td class="p-3 text-right font-semibold whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-red-600'}">
                    ${isIncome ? '+' : '-'} ${formatCurrency(t.jumlah)}
                </td>
            `;
            transactionList.appendChild(tr);
        });
    };
    
    // Fungsi Utilitas
    const populateDate = () => {
        document.getElementById('tanggal').value = new Date().toISOString().split('T')[0];
    };

    const populateFilters = () => {
        const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        filterBulan.innerHTML = '<option value="all">Semua Bulan</option>';
        months.forEach((month, index) => {
            filterBulan.innerHTML += `<option value="${index + 1}">${month}</option>`;
        });

        const years = [...new Set(transactions.map(t => new Date(t.tanggal).getFullYear()))].sort((a, b) => b - a);
        if(!years.includes(new Date().getFullYear())) years.unshift(new Date().getFullYear());
        filterTahun.innerHTML = '<option value="all">Semua Tahun</option>';
        years.forEach(year => {
            filterTahun.innerHTML += `<option value="${year}">${year}</option>`;
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
    };

    // Fungsi Ekspor
    const exportCSV = () => {
        const headers = 'ID,Tanggal,Keterangan,Akun,Jenis,Jumlah';
        const rows = transactions.map(t => 
            [t.id, t.tanggal, `"${t.keterangan.replace(/"/g, '""')}"`, t.akun, t.jenis, t.jumlah].join(',')
        ).join('\n');
        
        const csvContent = `data:text/csv;charset=utf-8,${headers}\n${rows}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `transaksi_keuangan_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportPDF = () => {
        const selectedBulan = filterBulan.options[filterBulan.selectedIndex].text;
        const selectedTahun = filterTahun.value;
        const reportTitleText = `Laporan Keuangan - ${selectedBulan} ${selectedTahun}`;
    
        let reportTitle = document.getElementById('report-title');
        if (!reportTitle) {
            reportTitle = document.createElement('div');
            reportTitle.id = 'report-title';
            reportTitle.style.display = 'none';
            document.body.prepend(reportTitle);
        }
        reportTitle.textContent = reportTitleText;

        const filtered = getFilteredTransactions();
        const pemasukan = filtered.filter(t => t.jenis === 'pemasukan').reduce((sum, t) => sum + t.jumlah, 0);
        const pengeluaran = filtered.filter(t => t.jenis === 'pengeluaran').reduce((sum, t) => sum + t.jumlah, 0);

        let reportSummary = document.getElementById('report-summary');
        if (!reportSummary) {
            reportSummary = document.createElement('div');
            reportSummary.id = 'report-summary';
            reportSummary.style.display = 'none';
            document.body.prepend(reportSummary);
        }
        reportSummary.innerHTML = `
            <h3>Ringkasan Laporan</h3>
            <p><strong>Total Pemasukan:</strong> ${formatCurrency(pemasukan)}</p>
            <p><strong>Total Pengeluaran:</strong> ${formatCurrency(pengeluaran)}</p>
            <p><strong>Arus Kas Bersih:</strong> ${formatCurrency(pemasukan - pengeluaran)}</p>
        `;
    
        const originalTableHTML = transactionList.innerHTML;
        const tableHeader = document.querySelector('#history-section thead');
        const originalHeaderHTML = tableHeader.innerHTML;
        
        tableHeader.innerHTML = `
            <tr>
                <th class="p-3 print-show">Tanggal</th>
                <th class="p-3 print-show">Keterangan</th>
                <th class="p-3 print-show">Akun</th>
                <th class="p-3 print-show text-right">Jumlah</th>
            </tr>
        `;
        const printBody = document.createElement('tbody');
        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const isIncome = t.jenis === 'pemasukan';
            tr.innerHTML = `
                <td class="p-3">${new Date(t.tanggal).toLocaleDateString('id-ID')}</td>
                <td class="p-3">${t.keterangan}</td>
                <td class="p-3">${t.akun}</td>
                <td class="p-3 text-right ${isIncome ? 'text-green-600' : 'text-red-600'}">
                    ${formatCurrency(t.jumlah)}
                </td>
            `;
            printBody.appendChild(tr);
        });
        transactionList.innerHTML = printBody.innerHTML;

        alert("Siapkan dialog cetak. Pilih 'Simpan sebagai PDF' untuk mengekspor.");
        
        setTimeout(() => {
            window.print();
            transactionList.innerHTML = originalTableHTML;
            tableHeader.innerHTML = originalHeaderHTML;
        }, 500);
    };

    // Jalankan aplikasi
    init();
});
        
