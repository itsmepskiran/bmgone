const API_BASE_URL = 'api';

function showNotice(message, type = 'success') {
    const existingNotice = document.querySelector('.notice');

    if (existingNotice) {
        existingNotice.remove();
    }

    const notice = document.createElement('div');
    notice.className = `notice notice-${type}`;
    notice.textContent = message;
    document.body.appendChild(notice);

    setTimeout(() => {
        notice.remove();
    }, 4500);
}

const quoteConfigs = {
    health: {
        formId: 'healthInsuranceForm',
        storageKey: 'healthInsuranceQuotes',
        tableId: 'savedQuotesTable',
        memberName: 'members',
        policies: [
            { provider: 'Care Health Insurance', plan: 'Care Supreme', cover: '₹10 Lakhs', basePremium: 9800, match: 'Best for family floater', features: ['No claim bonus', 'Annual health check-up', 'Wide hospital network'] },
            { provider: 'Star Health Insurance', plan: 'Family Health Optima', cover: '₹10 Lakhs', basePremium: 10200, match: 'Popular for families with children', features: ['Restore benefit', 'Maternity options', 'Day care coverage'] },
            { provider: 'HDFC ERGO', plan: 'Optima Secure', cover: '₹15 Lakhs', basePremium: 12800, match: 'Higher coverage preference', features: ['Secure benefit', 'Plus benefit', 'Cashless hospitalization'] },
            { provider: 'Niva Bupa', plan: 'ReAssure 2.0', cover: '₹10 Lakhs', basePremium: 9400, match: 'Good for young adults', features: ['Unlimited restore', 'Booster benefit', 'Modern treatments'] }
        ]
    },
    life: {
        formId: 'lifeInsuranceForm',
        storageKey: 'lifeInsuranceQuotes',
        tableId: 'savedLifeQuotesTable',
        memberName: 'dependents',
        policies: [
            { provider: 'LIC', plan: 'Term Protection Plus', cover: '₹1 Crore', basePremium: 11200, match: 'Trusted long-term protection', features: ['High claim settlement focus', 'Flexible premium mode', 'Nominee protection'] },
            { provider: 'HDFC Life', plan: 'Click 2 Protect', cover: '₹1 Crore', basePremium: 10500, match: 'Good term cover value', features: ['Life stage benefits', 'Critical illness option', 'Online servicing'] },
            { provider: 'ICICI Prudential', plan: 'iProtect Smart', cover: '₹1 Crore', basePremium: 10800, match: 'Balanced protection plan', features: ['Accidental cover option', 'Tax benefits', 'Multiple payout options'] },
            { provider: 'Tata AIA Life', plan: 'Sampoorna Raksha', cover: '₹1 Crore', basePremium: 10100, match: 'Cost-effective life cover', features: ['Whole life option', 'Terminal illness benefit', 'Premium waiver option'] }
        ]
    }
};

Object.entries(quoteConfigs).forEach(([insuranceType, config]) => {
    const form = document.getElementById(config.formId);

    if (form) {
        initialiseQuoteFlow(form, insuranceType, config);
    }
});

function initialiseQuoteFlow(form, insuranceType, config) {
    const steps = Array.from(form.querySelectorAll('.quote-step'));
    const progressSteps = Array.from(form.querySelectorAll('.progress-step'));
    const prevButton = form.querySelector('[data-prev-step]');
    const nextButton = form.querySelector('[data-next-step]');
    const submitButton = form.querySelector('[data-submit-step]');
    const quoteSummary = form.querySelector('[data-quote-summary]');
    const policyResults = form.querySelector('[data-policy-results]');
    const savedQuotesTable = document.getElementById(config.tableId);
    let currentStep = 0;
    let latestPremiums = [];

    function updateStep() {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === currentStep);
        });

        progressSteps.forEach((step, index) => {
            step.classList.toggle('active', index <= currentStep);
        });

        prevButton.style.display = currentStep === 0 ? 'none' : 'inline-flex';
        nextButton.style.display = currentStep === steps.length - 1 ? 'none' : 'inline-flex';
        submitButton.style.display = currentStep === steps.length - 1 ? 'inline-flex' : 'none';
    }

    function isCurrentStepValid() {
        const activeStep = steps[currentStep];
        const requiredFields = Array.from(activeStep.querySelectorAll('[data-step-required]'));
        const memberInputs = activeStep.querySelectorAll(`input[name="${config.memberName}"]`);

        if (memberInputs.length > 0 && activeStep.querySelectorAll(`input[name="${config.memberName}"]:checked`).length === 0) {
            showNotice('Please select at least one option to continue.', 'error');
            return false;
        }

        for (const field of requiredFields) {
            if (!field.value.trim()) {
                field.focus();
                showNotice('Please complete the required details to continue.', 'error');
                return false;
            }
        }

        return true;
    }

    function renderPolicies() {
        const quoteData = getQuoteData();
        const selectedMembers = quoteData.members;
        const eldestAge = quoteData.eldestAge || quoteData.age;
        const childrenCount = quoteData.childrenCount;
        const city = quoteData.city;
        const hasParents = selectedMembers.some((member) => member.includes('Father') || member.includes('Mother'));
        const hasChildren = selectedMembers.includes('Son') || selectedMembers.includes('Daughter') || selectedMembers.includes('Children') || childrenCount !== '0';
        const ageNumber = Number(eldestAge);

        const rankedPolicies = [...config.policies].sort((firstPolicy, secondPolicy) => {
            return getPolicyScore(secondPolicy, insuranceType, hasParents, hasChildren, ageNumber) - getPolicyScore(firstPolicy, insuranceType, hasParents, hasChildren, ageNumber);
        });

        if (quoteSummary) {
            quoteSummary.innerHTML = `
                <strong>Quote Summary:</strong>
                ${selectedMembers.join(', ')} ${eldestAge ? `| Eldest age: ${eldestAge}` : ''} ${city ? `| City: ${city}` : ''}
            `;
        }

        latestPremiums = rankedPolicies.map((policy) => ({
            ...policy,
            premium: calculatePremium(policy.basePremium, insuranceType, selectedMembers.length, ageNumber, hasParents, hasChildren, quoteData)
        }));

        if (policyResults) {
            policyResults.innerHTML = latestPremiums.map((policy, index) => `
                <article class="policy-card">
                    <div>
                        <span class="policy-rank">Top ${index + 1}</span>
                        <h3>${policy.provider}</h3>
                        <p>${policy.plan}</p>
                    </div>
                    <div class="policy-cover">
                        <span>Estimated Annual Premium</span>
                        <strong>₹${policy.premium.toLocaleString('en-IN')}</strong>
                        <small>${policy.cover} cover</small>
                    </div>
                    <p class="policy-match">${policy.match}</p>
                    <ul>
                        ${policy.features.map((feature) => `<li>${feature}</li>`).join('')}
                    </ul>
                    <button class="btn-secondary" type="button">Request Callback</button>
                </article>
            `).join('');
        }

        renderSavedQuotes();
    }

    function calculatePremium(basePremium, type, memberCount, ageNumber, hasParents, hasChildren, quoteData) {
        let premium = basePremium;

        if (type === 'health') {
            premium += Math.max(memberCount - 1, 0) * 2400;
            premium += ageNumber > 45 ? 3500 : ageNumber > 35 ? 1800 : 0;
            premium += hasParents ? 5200 : 0;
            premium += hasChildren ? 1200 : 0;
        } else {
            premium *= getCoverageMultiplier(quoteData.coverage);
            premium += ageNumber > 50 ? 6200 : ageNumber > 40 ? 3400 : ageNumber > 30 ? 1500 : 0;
            premium += getIncomeMultiplier(quoteData.income);
            premium += memberCount * 650;
        }

        return Math.round(premium / 100) * 100;
    }

    function getQuoteData() {
        const selectedMembers = Array.from(form.querySelectorAll(`input[name="${config.memberName}"]:checked`)).map((member) => member.value);
        const lowestPremium = latestPremiums.length ? Math.min(...latestPremiums.map((policy) => policy.premium)) : 0;

        return {
            id: Date.now(),
            insuranceType,
            name: form.elements['name']?.value || '',
            phone: form.elements['phone']?.value || '',
            email: form.elements['email']?.value || '',
            city: form.elements['city']?.value || '',
            age: form.elements['age']?.value || '',
            eldestAge: form.elements['eldestAge']?.value || '',
            childrenCount: form.elements['childrenCount']?.value || '0',
            income: form.elements['income']?.value || '',
            planType: form.elements['planType']?.value || '',
            coverage: form.elements['coverage']?.value || '',
            nominee: form.elements['nominee']?.value || '',
            relationship: form.elements['relationship']?.value || '',
            members: selectedMembers,
            requirements: form.elements['requirements']?.value || '',
            policies: latestPremiums,
            lowestPremium,
            createdAt: new Date().toISOString()
        };
    }

    async function saveQuoteData() {
        if (latestPremiums.length === 0) {
            renderPolicies();
        }

        const quoteData = getQuoteData();
        const quotes = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
        quotes.unshift(quoteData);
        localStorage.setItem(config.storageKey, JSON.stringify(quotes));
        renderSavedQuotes();

        try {
            const response = await fetch(`${API_BASE_URL}/save_quote.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(quoteData)
            });

            if (!response.ok) {
                throw new Error('API save failed');
            }

            showNotice('Quote saved to database successfully.');
        } catch (error) {
            showNotice('Quote saved in browser. Start XAMPP Apache/MySQL to save into database.', 'error');
        }
    }

    async function loadSavedQuotes() {
        try {
            const response = await fetch(`${API_BASE_URL}/get_quotes.php?type=${insuranceType}`);

            if (!response.ok) {
                throw new Error('API load failed');
            }

            const data = await response.json();
            renderQuotesTable(data.quotes || []);
        } catch (error) {
            renderSavedQuotes();
        }
    }

    function renderSavedQuotes() {
        const quotes = JSON.parse(localStorage.getItem(config.storageKey) || '[]');
        renderQuotesTable(quotes);
    }

    function renderQuotesTable(quotes) {
        if (!savedQuotesTable) {
            return;
        }

        savedQuotesTable.innerHTML = quotes.map((quote) => `
            <tr>
                <td>${quote.name || quote.customer_name || ''}</td>
                <td>${quote.phone || ''}</td>
                <td>${Array.isArray(quote.members) ? quote.members.join(', ') : quote.members_json || ''}</td>
                <td>${quote.age || quote.eldestAge || quote.eldest_age || ''}</td>
                <td>${quote.city || ''}</td>
                <td>₹${Number(quote.lowestPremium || quote.lowest_annual_premium || 0).toLocaleString('en-IN')}</td>
            </tr>
        `).join('');
    }

    nextButton.addEventListener('click', () => {
        if (!isCurrentStepValid()) {
            return;
        }

        currentStep = Math.min(currentStep + 1, steps.length - 1);
        updateStep();

        if (currentStep === steps.length - 1) {
            renderPolicies();
        }
    });

    prevButton.addEventListener('click', () => {
        currentStep = Math.max(currentStep - 1, 0);
        updateStep();
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveQuoteData();
        form.reset();
        currentStep = 0;
        latestPremiums = [];
        updateStep();
    });

    updateStep();
    loadSavedQuotes();
}

function getPolicyScore(policy, type, hasParents, hasChildren, ageNumber) {
    let score = 0;

    if (type === 'health') {
        if (hasParents && policy.provider.includes('HDFC')) score += 3;
        if (hasChildren && policy.provider.includes('Star')) score += 3;
        if (ageNumber < 35 && policy.provider.includes('Niva')) score += 2;
        if (policy.provider.includes('Care')) score += 1;
    } else {
        if (policy.provider.includes('LIC')) score += ageNumber > 40 ? 3 : 1;
        if (policy.provider.includes('HDFC')) score += ageNumber <= 40 ? 3 : 1;
        if (policy.provider.includes('Tata')) score += 2;
    }

    return score;
}

function getCoverageMultiplier(coverage) {
    if (coverage.includes('5 Crore')) return 4.8;
    if (coverage.includes('2 Crore')) return 2.2;
    if (coverage.includes('1 Crore')) return 1;
    if (coverage.includes('50 Lakhs')) return 0.58;
    return 0.35;
}

function getIncomeMultiplier(income) {
    if (income.includes('25 Lakhs')) return 2400;
    if (income.includes('10 Lakhs')) return 1400;
    if (income.includes('5 Lakhs')) return 800;
    return 400;
}
