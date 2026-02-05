const tg = window.Telegram.WebApp;
tg.expand();

const ISINS = [
    "RU000A108P79", "RU000A10BBW8", "RU000A1082Q4", "RU000A10B7J8", 
    "RU000A10C9Y2", "RU000A10CRC4", "RU000A1059Q2", "RU000A10CMR3", 
    "SU26233RMFS5", "SU26235RMFS0", "SU26238RMFS4", "SU26243RMFS4", 
    "SU26244RMFS2", "SU26247RMFS5", "SU26248RMFS3", "SU26249RMFS1", 
    "SU26252RMFS5", "RU000A10DQB6", "RU000A10DQA8"
];

let bondData = [];
async function loadUserQuantities() {
    const res = await fetch('data.json');
    userQuantities = await res.json();
}

let currentPage = 'bonds';

// DOM Elements
const appContent = document.getElementById('appContent');
const pageTitle = document.getElementById('pageTitle');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const menuBtn = document.getElementById('menuBtn');
const closeMenu = document.getElementById('closeMenu');
const navBonds = document.getElementById('navBonds');
const navCoupons = document.getElementById('navCoupons');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadAllData();
});

function setupEventListeners() {
    menuBtn.onclick = openMenu;
    closeMenu.onclick = closeMenuFunc;
    overlay.onclick = closeMenuFunc;
    
    navBonds.onclick = () => {
        switchPage('bonds');
        closeMenuFunc();
    };
    
    navCoupons.onclick = () => {
        switchPage('coupons');
        closeMenuFunc();
    };
}

function openMenu() {
    sideMenu.classList.add('open');
    overlay.classList.add('visible');
}

function closeMenuFunc() {
    sideMenu.classList.remove('open');
    overlay.classList.remove('visible');
}

function switchPage(page) {
    currentPage = page;
    pageTitle.innerText = page === 'bonds' ? 'Облигации' : 'Предстоящие купоны';
    
    navBonds.classList.toggle('active', page === 'bonds');
    navCoupons.classList.toggle('active', page === 'coupons');
    
    render();
}

async function loadAllData() {
    showLoader();
    try {
        const results = await Promise.all(ISINS.map(isin => fetchBondData(isin)));
        bondData = results.filter(b => b !== null);
        render();
    } catch (error) {
        console.error("Global load error:", error);
        appContent.innerHTML = `<div class="empty-state">Ошибка загрузки данных. Проверьте соединение.</div>`;
    }
}

async function fetchBondData(isin) {
    try {
        // 1. Get Security Description (Name, FaceValue)
        const descUrl = `https://iss.moex.com/iss/securities/${isin}.json?iss.meta=off&description.columns=name,value`;
        const descRes = await fetch(descUrl);
        const descJson = await descRes.json();
        
        const descData = descJson.description.data;
        const getDesc = (id) => descData.find(row => row[0] === id)?.[1];
        
        const name = getDesc('NAME') || isin;
        const faceValue = parseFloat(getDesc('FACEVALUE')) || 1000;
        const currency = getDesc('FACEUNIT') || 'RUB';

        // 2. Get Market Data (Price, Coupon, Next Date)
        // Determine board: TQOB for OFZ (SU...), TQCB for Corporate (RU...)
        const board = isin.startsWith('SU') ? 'TQOB' : 'TQCB';
        const marketUrl = `https://iss.moex.com/iss/engines/stock/markets/bonds/boards/${board}/securities/${isin}.json?iss.meta=off`;
        const marketRes = await fetch(marketUrl);
        const marketJson = await marketRes.json();
        
        if (!marketJson.securities || marketJson.securities.data.length === 0) {
            return { isin, name, faceValue, currency, price: 0, coupon: 0, nextCoupon: null, board };
        }

        const secData = marketJson.securities.data[0];
        const secCols = marketJson.securities.columns;
        const mktData = marketJson.marketdata.data[0];
        const mktCols = marketJson.marketdata.columns;

        const getVal = (data, cols, field) => data[cols.indexOf(field)];

        const price = getVal(mktData, mktCols, 'LAST') || getVal(secData, secCols, 'PREVPRICE') || 0;
        const coupon = parseFloat(getVal(secData, secCols, 'COUPONVALUE')) || 0;
        const nextCoupon = getVal(secData, secCols, 'NEXTCOUPON');

        return { isin, name, faceValue, currency, price, coupon, nextCoupon, board };
    } catch (e) {
        console.error(`Error fetching ${isin}:`, e);
        return null;
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function showLoader() {
    appContent.innerHTML = `
        <div class="loader-wrapper">
            <div class="spinner"></div>
            <p>Загрузка данных с Мосбиржи...</p>
        </div>`;
}

function updateQuantity(isin) {
    const current = userQuantities[isin] || 0;
    const newVal = prompt(`Количество облигаций ${isin}:`, current);
    if (newVal !== null) {
        const num = parseInt(newVal);
        if (!isNaN(num) && num >= 0) {
            userQuantities[isin] = num;
            localStorage.setItem('bondQuantities', JSON.stringify(userQuantities));
            render();
        } else {
            alert("Введите корректное число.");
        }
    }
}

function render() {
    appContent.innerHTML = '';
    
    if (currentPage === 'bonds') {
        renderBonds();
    } else {
        renderCoupons();
    }
}

function renderBonds() {
    if (bondData.length === 0) {
        appContent.innerHTML = '<div class="empty-state">Нет данных для отображения.</div>';
        return;
    }

    bondData.forEach(bond => {
        const qty = userQuantities[bond.isin] || 0;
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <a href="https://www.moex.com/ru/issue.aspx?board=${bond.board}&code=${bond.isin}" target="_blank" class="card-title">${bond.name}</a>
            <span class="card-isin">${bond.isin}</span>
            <div class="card-grid">
                <div class="info-block">
                    <span class="info-label">Номинал</span>
                    <span class="info-value">${bond.faceValue} ${bond.currency}</span>
                </div>
                <div class="info-block">
                    <span class="info-label">Цена</span>
                    <span class="info-value">${bond.price}%</span>
                </div>
                <div class="info-block">
                    <span class="info-label">Купон</span>
                    <span class="info-value">${bond.coupon} ${bond.currency}</span>
                </div>
                <div class="info-block">
                    <span class="info-label">След. купон</span>
                    <span class="info-value">${formatDate(bond.nextCoupon)}</span>
                </div>
            </div>
            <div class="qty-section">
                <div class="qty-display">В портфеле: <span class="qty-count">${qty}</span> шт.</div>
                <button class="btn-edit" onclick="updateQuantity('${bond.isin}')">Изменить</button>
            </div>
        `;
        appContent.appendChild(card);
    });
}

function renderCoupons() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const upcoming = bondData.filter(bond => {
        if (!bond.nextCoupon) return false;
        const couponDate = new Date(bond.nextCoupon);
        const diffTime = couponDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        // Logic: 7 days before and 7 days after
        return diffDays >= -7 && diffDays <= 7;
    });

    if (upcoming.length === 0) {
        appContent.innerHTML = '<div class="empty-state">Нет ближайших выплат (±7 дней от сегодня)</div>';
        return;
    }

    upcoming.forEach(bond => {
        const qty = userQuantities[bond.isin] || 0;
        const totalPayout = (bond.coupon * qty).toFixed(2);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <a href="https://www.moex.com/ru/issue.aspx?board=${bond.board}&code=${bond.isin}" target="_blank" class="card-title">${bond.name}</a>
            <span class="card-isin">${bond.isin}</span>
            <div class="card-grid">
                <div class="info-block">
                    <span class="info-label">Дата выплаты</span>
                    <span class="info-value">${formatDate(bond.nextCoupon)}</span>
                </div>
                <div class="info-block">
                    <span class="info-label">Купон (1 шт)</span>
                    <span class="info-value">${bond.coupon} ${bond.currency}</span>
                </div>
                <div class="info-block">
                    <span class="info-label">Количество</span>
                    <span class="info-value">${qty} шт.</span>
                </div>
                <div class="info-block">
                    <span class="info-label">Сумма выплаты</span>
                    <span class="info-value payout-value">${totalPayout} ${bond.currency}</span>
                </div>
            </div>
        `;
        appContent.appendChild(card);
    });
}
