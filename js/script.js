        document.addEventListener('DOMContentLoaded', () => {
            // --- DOM Elements ---
            const setupScreen = document.getElementById('setup-screen');
            const mainTracker = document.getElementById('main-tracker');
            const setupOptions = document.querySelector('.setup-options');
            const caffeineLevelEl = document.getElementById('caffeine-level');
            const add1ShotBtn = document.getElementById('add-1shot');
            const add2ShotsBtn = document.getElementById('add-2shots');
            const add4ShotsBtn = document.getElementById('add-4shots');
            const addPastBtn = document.getElementById('add-past-btn');
            const chartCanvas = document.getElementById('caffeine-chart');
            const resetBtn = document.getElementById('reset-btn');
            const helpBtn = document.getElementById('help-btn');
            const historyBtn = document.getElementById('history-btn');

            const helpModal = document.getElementById('help-modal');
            const closeHelpBtn = document.getElementById('close-help-btn');
            
            const pastEntryModal = document.getElementById('past-entry-modal');
            const closePastEntryBtn = document.getElementById('close-past-entry-btn');
            const pastTimeInput = document.getElementById('past-time-input');
            const savePastEntryBtn = document.getElementById('save-past-entry-btn');
            const pastEntryAmountBtns = pastEntryModal.querySelector('.modal-controls');

            const historyModal = document.getElementById('history-modal');
            const closeHistoryBtn = document.getElementById('close-history-btn');
            const historyListEl = document.getElementById('history-list');

            // --- Constants ---
            const LOG_KEY = 'caffeineLog';
            const SETUP_KEY = 'caffInMe_setupComplete';
            const HALF_LIFE_MS = 5 * 60 * 60 * 1000;

            let caffeineChart = null;
            let selectedPastAmount = 0;

            // --- Data Layer ---
            const getLog = () => JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
            const saveLog = (log) => {
                log.sort((a, b) => a.timestamp - b.timestamp);
                localStorage.setItem(LOG_KEY, JSON.stringify(log));
            };

            // --- Business Logic ---
            const calculateCaffeineAtTime = (log, time) => {
                let totalCaffeine = 0;
                log.forEach(entry => {
                    const timeElapsed = time - entry.timestamp;
                    if (timeElapsed >= 0) {
                        totalCaffeine += entry.amount * Math.pow(0.5, timeElapsed / HALF_LIFE_MS);
                    }
                });
                return totalCaffeine;
            };

            const formatTimestamp = (timestamp) => {
                const date = new Date(timestamp);
                const now = new Date();
                const isToday = date.toDateString() === now.toDateString();
                const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

                const timeString = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });

                if (isToday) return `오늘 ${timeString}`;
                if (isYesterday) return `어제 ${timeString}`;
                
                return `${date.toLocaleDateString('ko-KR')} ${timeString}`;
            };

            // --- Presentation Layer ---
            const updateCaffeineDisplay = () => {
                const log = getLog();
                const currentLevel = calculateCaffeineAtTime(log, Date.now());
                caffeineLevelEl.textContent = `${Math.round(currentLevel)} mg`;
            };

            const renderChart = () => {
                const log = getLog();
                const now = Date.now();
                const labels = [];
                const dataPoints = [];

                for (let i = -12; i <= 12; i += 0.5) {
                    const time = now + i * 60 * 60 * 1000;
                    if (i === 0) { labels.push('Now'); } 
                    else { labels.push(`${i > 0 ? '+' : ''}${i}h`); }
                    dataPoints.push(calculateCaffeineAtTime(log, time));
                }

                const chartData = {
                    labels: labels,
                    datasets: [{
                        label: '체내 카페인 농도 (mg)',
                        data: dataPoints,
                        borderColor: '#FB923C',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0,
                        pointHitRadius: 10,
                        backgroundColor: function(context) {
                            const {ctx, chartArea, scales} = context.chart;
                            if (!chartArea) return null;
                            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                            const y50 = scales.y.getPixelForValue(50);
                            const stop = Math.max(0, Math.min(1, (y50 - chartArea.top) / chartArea.height));
                            const highColor = 'rgba(251, 146, 60, 0.2)';
                            const lowColor = 'rgba(72, 187, 120, 0.2)';
                            if (scales.y.max <= 50) {
                                 gradient.addColorStop(0, lowColor); gradient.addColorStop(1, lowColor);
                            } else if (scales.y.min >= 50) {
                                 gradient.addColorStop(0, highColor); gradient.addColorStop(1, highColor);
                            } else {
                                gradient.addColorStop(0, highColor); gradient.addColorStop(stop, highColor);
                                gradient.addColorStop(stop, lowColor); gradient.addColorStop(1, lowColor);
                            }
                            return gradient;
                        },
                    }]
                };

                if (caffeineChart) {
                    caffeineChart.data = chartData;
                    caffeineChart.update('none');
                } else {
                    const ctx = chartCanvas.getContext('2d');
                    caffeineChart = new Chart(ctx, {
                        type: 'line',
                        data: chartData,
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { color: '#1C1917' }, grid: { color: 'rgba(0,0,0,0.05)' } },
                                      x: { ticks: { color: '#1C1917' }, grid: { display: false } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
            };

            const renderHistoryList = () => {
                const log = getLog();
                historyListEl.innerHTML = ''; // Clear previous list

                if (log.length === 0) {
                    historyListEl.innerHTML = '<li class="empty-history">섭취 기록이 없습니다.</li>';
                    return;
                }

                log.slice().reverse().forEach(entry => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div>
                            <span class="time">${formatTimestamp(entry.timestamp)}</span>
                            <span class="amount">${entry.amount} mg</span>
                        </div>
                        <button class="delete-log-btn" data-timestamp="${entry.timestamp}">&times;</button>
                    `;
                    historyListEl.appendChild(li);
                });
            };

            // --- App Logic ---
            const updateAll = () => { updateCaffeineDisplay(); renderChart(); };

            const addCaffeine = (amount, timestamp) => {
                const log = getLog();
                log.push({ timestamp: timestamp, amount: amount });
                const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
                const cleanedLog = log.filter(entry => entry.timestamp > twentyFourHoursAgo);
                saveLog(cleanedLog);
                updateAll();
            };

            const startApp = () => {
                mainTracker.classList.remove('hidden');
                setupScreen.classList.add('hidden');
                updateAll();
                setInterval(updateAll, 60000);
            };

            // --- Initialization ---
            add1ShotBtn.addEventListener('click', () => addCaffeine(75, Date.now()));
            add2ShotsBtn.addEventListener('click', () => addCaffeine(150, Date.now()));
            add4ShotsBtn.addEventListener('click', () => addCaffeine(300, Date.now()));

            resetBtn.addEventListener('click', () => {
                if (confirm('모든 기록을 삭제하고 초기 설정 화면으로 돌아가시겠습니까?')) {
                    localStorage.removeItem(LOG_KEY);
                    localStorage.removeItem(SETUP_KEY);
                    window.location.reload();
                }
            });

            // --- Modal Event Listeners ---
            helpBtn.addEventListener('click', () => helpModal.classList.remove('hidden'));
            closeHelpBtn.addEventListener('click', () => helpModal.classList.add('hidden'));
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) { helpModal.classList.add('hidden'); }
            });

            addPastBtn.addEventListener('click', () => {
                pastEntryModal.classList.remove('hidden');
                pastTimeInput.value = new Date(Date.now() - 3600 * 1000).toISOString().slice(0, 16);
                selectedPastAmount = 0;
                [...pastEntryAmountBtns.children].forEach(btn => btn.style.border = '2px solid transparent');
            });
            closePastEntryBtn.addEventListener('click', () => pastEntryModal.classList.add('hidden'));
            pastEntryModal.addEventListener('click', (e) => {
                if (e.target === pastEntryModal) { pastEntryModal.classList.add('hidden'); }
            });
            
            pastEntryAmountBtns.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    selectedPastAmount = parseFloat(e.target.dataset.amount);
                    [...pastEntryAmountBtns.children].forEach(btn => btn.style.border = '2px solid transparent');
                    e.target.style.border = '2px solid #FB923C';
                }
            });

            savePastEntryBtn.addEventListener('click', () => {
                const pastTime = pastTimeInput.value;
                if (selectedPastAmount === 0) {
                    alert('섭취량을 선택해주세요.');
                    return;
                }
                if (!pastTime) {
                    alert('섭취 시간을 선택해주세요.');
                    return;
                }
                const timestamp = new Date(pastTime).getTime();
                if (timestamp > Date.now()) {
                    alert('미래 시간은 선택할 수 없습니다.');
                    return;
                }
                addCaffeine(selectedPastAmount, timestamp);
                pastEntryModal.classList.add('hidden');
            });

            historyBtn.addEventListener('click', () => {
                renderHistoryList();
                historyModal.classList.remove('hidden');
            });
            closeHistoryBtn.addEventListener('click', () => historyModal.classList.add('hidden'));
            historyModal.addEventListener('click', (e) => {
                if (e.target === historyModal) { historyModal.classList.add('hidden'); }
            });

            historyListEl.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-log-btn')) {
                    const timestamp = parseInt(e.target.dataset.timestamp, 10);
                    if (confirm('이 기록을 삭제하시겠습니까?')) {
                        let log = getLog();
                        log = log.filter(entry => entry.timestamp !== timestamp);
                        saveLog(log);
                        updateAll();
                        renderHistoryList(); // Re-render the list in the modal
                    }
                }
            });

            setupOptions.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const initialAmount = parseFloat(e.target.dataset.amount);
                    if (initialAmount > 0) {
                        addCaffeine(initialAmount, Date.now());
                    }
                    localStorage.setItem(SETUP_KEY, 'true');
                    startApp();
                }
            });

            if (localStorage.getItem(SETUP_KEY) === 'true') {
                startApp();
            } else {
                setupScreen.classList.remove('hidden');
            }
        });
