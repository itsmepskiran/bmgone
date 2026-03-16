// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 100) {
        navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        navbar.style.backdropFilter = 'blur(10px)';
    } else {
        navbar.style.background = '#fff';
        navbar.style.backdropFilter = 'none';
    }
});

// Smooth Scroll for Navigation Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 70; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Contact Form Handler
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Get form data
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value
    };
    
    // Simple validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    // Simulate form submission (in a real application, this would send to a server)
    showNotification('Thank you for your message! We will get back to you soon.', 'success');
    
    // Reset form
    this.reset();
});

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.background = '#28a745';
            break;
        case 'error':
            notification.style.background = '#dc3545';
            break;
        default:
            notification.style.background = '#007bff';
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 5000);
}

// Intersection Observer for Animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.service-card, .feature, .about-text, .contact-content');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
        observer.observe(el);
    });
    
    // Fallback: Make sure content is visible after 3 seconds even if observer fails
    setTimeout(() => {
        animateElements.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
    }, 3000);
});

// Active Navigation Link Highlighting
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section');
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (scrollY >= (sectionTop - 200)) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

// Logo Click Handler - Remove modal functionality since it's a logo now
document.querySelectorAll('img[src="logo.webp"]').forEach(logoImage => {
    logoImage.style.cursor = 'default';
    logoImage.title = 'BMGOne Logo';
});

// Loading Animation
window.addEventListener('load', () => {
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.5s ease';
    
    setTimeout(() => {
        document.body.style.opacity = '1';
    }, 100);
});

// Typing Effect for Hero Title
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Initialize typing effect when page loads
document.addEventListener('DOMContentLoaded', () => {
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const originalText = heroTitle.textContent;
        typeWriter(heroTitle, originalText, 80);
    }
});

// Parallax Effect for Hero Section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
        hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
});

// Service Cards Hover Effect
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px) scale(1.02)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0) scale(1)';
    });
});

// Add active class styling
const style = document.createElement('style');
style.textContent = `
    .nav-link.active {
        color: var(--primary-teal) !important;
    }
    
    .nav-link.active::after {
        width: 100% !important;
    }
    
    .hamburger.active .bar:nth-child(2) {
        opacity: 0;
    }
    
    .hamburger.active .bar:nth-child(1) {
        transform: translateY(8px) rotate(45deg);
    }
    
    .hamburger.active .bar:nth-child(3) {
        transform: translateY(-8px) rotate(-45deg);
    }
`;
document.head.appendChild(style);

// ============================================
// INSURANCE PAGES JAVASCRIPT
// ============================================

// Client List Expand/Collapse (for health and general insurance)
document.addEventListener('DOMContentLoaded', function() {
    const clientItems = document.querySelectorAll('.client-item');
    
    if (clientItems.length > 0) {
        clientItems.forEach(item => {
            const header = item.querySelector('.client-header');
            
            header.addEventListener('click', function() {
                const isExpanded = item.classList.contains('expanded');
                
                // Close all other items
                clientItems.forEach(otherItem => {
                    if (otherItem !== item) {
                        otherItem.classList.remove('expanded');
                    }
                });
                
                // Toggle current item
                item.classList.toggle('expanded');
                
                // Update aria-expanded
                header.setAttribute('aria-expanded', !isExpanded);
            });
            
            // Keyboard support
            header.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.click();
                }
            });
        });
    }
});

// Function to toggle client items from logo clicks (for health insurance)
function toggleClientItem(clientId) {
    const targetItem = document.querySelector(`[data-client="${clientId}"]`);
    const allItems = document.querySelectorAll('.client-item');
    
    if (targetItem) {
        // Close all other items
        allItems.forEach(item => {
            if (item !== targetItem) {
                item.classList.remove('expanded');
            }
        });
        
        // Toggle target item
        targetItem.classList.toggle('expanded');
        
        // Smooth scroll to client item
        setTimeout(() => {
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    }
}

// Provider Container Toggle Function (for life insurance)
function toggleProviderContainer(providerId) {
    // Get all provider containers
    const allContainers = document.querySelectorAll('.provider-container');
    const targetContainer = document.getElementById(providerId + '-container');
    const allLogoItems = document.querySelectorAll('.logo-item');
    const targetLogoItem = event.currentTarget;
    
    // Close all other containers
    allContainers.forEach(container => {
        if (container !== targetContainer) {
            container.style.display = 'none';
        }
    });
    
    // Remove active class from all logo items
    allLogoItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Toggle the target container
    if (targetContainer) {
        if (targetContainer.style.display === 'none' || targetContainer.style.display === '') {
            targetContainer.style.display = 'block';
            targetLogoItem.classList.add('active');
            
            // Smooth scroll to the container
            setTimeout(() => {
                targetContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            targetContainer.style.display = 'none';
            targetLogoItem.classList.remove('active');
        }
    }
}

// Brochure Modal Functions (shared across all insurance pages)
function openBrochure(title, brochurePath) {
    const modal = document.getElementById('brochureModal');
    const frame = document.getElementById('brochureFrame');
    const titleElement = document.getElementById('brochureTitle');
    const modalBody = modal.querySelector('.brochure-modal-body');
    
    if (modal && frame && titleElement && modalBody) {
        titleElement.textContent = title + ' - Brochure';
        modalBody.classList.add('loading');
        
        const pdfUrl = brochurePath;
        frame.src = pdfUrl;
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        frame.onload = function() {
            modalBody.classList.remove('loading');
        };
        
        setTimeout(function() {
            if (modalBody.classList.contains('loading')) {
                frame.src = 'https://docs.google.com/gview?embedded=true&url=' + encodeURIComponent(window.location.origin + '/' + pdfUrl);
            }
        }, 3000);
    }
}

function closeBrochureModal() {
    const modal = document.getElementById('brochureModal');
    const frame = document.getElementById('brochureFrame');
    
    if (modal && frame) {
        modal.style.display = 'none';
        frame.src = '';
        document.body.style.overflow = 'auto';
    }
}

// Close modals when clicking outside (shared)
document.addEventListener('click', function(e) {
    const brochureModal = document.getElementById('brochureModal');
    if (brochureModal && e.target === brochureModal) {
        closeBrochureModal();
    }
});

// Close modals with Escape key (shared)
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const brochureModal = document.getElementById('brochureModal');
        if (brochureModal && brochureModal.style.display === 'block') {
            closeBrochureModal();
        }
    }
});

// Form Handlers for insurance pages
document.addEventListener('DOMContentLoaded', function() {
    // Health Insurance Form
    const healthForm = document.getElementById('healthForm');
    if (healthForm) {
        healthForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                planType: document.getElementById('planType').value,
                provider: document.getElementById('provider').value,
                message: document.getElementById('message').value,
                type: 'Health Insurance'
            };
            
            showNotification(`Thank you ${formData.name}! Your Health Insurance quote request has been received. We'll contact you soon.`, 'success');
            this.reset();
        });
    }
    
    // General Insurance Form
    const generalForm = document.getElementById('generalForm');
    if (generalForm) {
        generalForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                insuranceType: document.getElementById('insuranceType').value,
                provider: document.getElementById('provider').value,
                message: document.getElementById('message').value,
                type: 'General Insurance'
            };
            
            showNotification(`Thank you ${formData.name}! Your General Insurance quote request has been received. We'll contact you soon.`, 'success');
            this.reset();
        });
    }
    
    // Life Insurance Provider Forms
    const providerForms = ['lic-form', 'tata-aig-form', 'hdfc-life-form', 'icici-prudential-form'];
    
    providerForms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const providerName = formId.replace('-form', '').charAt(0).toUpperCase() + formId.replace('-form', '').slice(1);
                showNotification(`Thank you! Your quote request for ${providerName} has been received. We'll contact you soon.`, 'success');
                this.reset();
            });
        }
    });
    
    // Health Insurance Provider Forms
    const healthProviderForms = ['care-form', 'star-form', 'tata-aig-form', 'hdfc-ergo-form', 'icici-lombard-form', 'manipal-cigna-form', 'bajaj-allianz-form', 'niva-form', 'aditya-form'];
    
    healthProviderForms.forEach(formId => {
        const form = document.getElementById(formId);
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                const providerName = formId.replace('-form', '').replace(/-/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                showNotification(`Thank you! Your quote request for ${providerName} has been received. We'll contact you soon.`, 'success');
                this.reset();
            });
        }
    });
});