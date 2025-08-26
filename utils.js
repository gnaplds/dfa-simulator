// utils.js - Shared utility functions

/**
 * Show animated notification to user
 */
function showNotification(message, type = 'info') {
    // Remove any existing notifications first
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.3s ease;
        transform: translateX(400px);
        opacity: 0;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #98C379, #50a14f)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #E06C75, #e45649)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #56b6c2, #0184bc)';
    }
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    }, 100);
    
    // Animate out and remove
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

/**
 * Theme management utilities
 */
class ThemeManager {
    static toggleTheme() {
        const root = document.documentElement;
        const themeToggle = document.querySelector('.theme-toggle');
        
        if (root.classList.contains('light-mode')) {
            root.classList.remove('light-mode');
            if (themeToggle) themeToggle.textContent = '🌔';
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.add('light-mode');
            if (themeToggle) themeToggle.textContent = '🌞';
            localStorage.setItem('theme', 'light');
        }
        
        // Redraw canvas with new theme colors
        if (window.simulator && window.simulator.draw) {
            window.simulator.draw();
        }
    }

    static initializeTheme() {
        const savedTheme = localStorage.getItem('theme');
        const root = document.documentElement;
        const themeToggle = document.querySelector('.theme-toggle');
        
        if (savedTheme === 'light') {
            root.classList.add('light-mode');
            if (themeToggle) themeToggle.textContent = '🌞';
        } else {
            if (themeToggle) themeToggle.textContent = '🌔';
        }
    }

    static getThemeColors() {
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        
        return {
            bgPrimary: computedStyle.getPropertyValue('--bg-primary').trim(),
            bgSecondary: computedStyle.getPropertyValue('--bg-secondary').trim(),
            textPrimary: computedStyle.getPropertyValue('--text-primary').trim(),
            textSecondary: computedStyle.getPropertyValue('--text-secondary').trim(),
            accent: computedStyle.getPropertyValue('--accent').trim(),
            accent2: computedStyle.getPropertyValue('--accent2').trim(),
            success: computedStyle.getPropertyValue('--success').trim(),
            info: computedStyle.getPropertyValue('--info').trim(),
            danger: computedStyle.getPropertyValue('--danger').trim(),
            border: computedStyle.getPropertyValue('--border').trim(),
            shadow: computedStyle.getPropertyValue('--shadow').trim(),
            isLightMode: root.classList.contains('light-mode')
        };
    }
}

/**
 * Canvas utilities
 */
class CanvasUtils {
    static setupCanvas(canvas) {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        
        return ctx;
    }

    static getCanvasCoordinates(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        if (event.touches && event.touches.length > 0) {
            const touch = event.touches[0];
            return {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
        }
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }
}

/**
 * Math utilities
 */
class MathUtils {
    static distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    static pointToLineDistance(x, y, x1, y1, x2, y2) {
        const A = y2 - y1;
        const B = x1 - x2;
        const C = x2 * y1 - x1 * y2;
        
        return Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
    }

    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static generateSecureId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(array[i] % chars.length);
        }
        return result;
    }
}

/**
 * Event handling utilities
 */
class EventUtils {
    static addTouchAndMouseListeners(element, handlers) {
        // Touch events
        element.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const coords = CanvasUtils.getCanvasCoordinates(e, element);
            if (handlers.onDown) handlers.onDown(coords.x, coords.y);
        });
        
        element.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const coords = CanvasUtils.getCanvasCoordinates(e, element);
            if (handlers.onMove) handlers.onMove(coords.x, coords.y);
        });
        
        element.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (handlers.onUp) handlers.onUp();
        });
        
        // Mouse events
        element.addEventListener('mousedown', (e) => {
            const coords = CanvasUtils.getCanvasCoordinates(e, element);
            if (handlers.onDown) handlers.onDown(coords.x, coords.y);
        });
        
        element.addEventListener('mousemove', (e) => {
            const coords = CanvasUtils.getCanvasCoordinates(e, element);
            if (handlers.onMove) handlers.onMove(coords.x, coords.y);
            if (handlers.onHover) handlers.onHover(coords.x, coords.y);
        });
        
        element.addEventListener('mouseup', () => {
            if (handlers.onUp) handlers.onUp();
        });
        
        // Prevent context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Prevent scrolling on touch
        element.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        showNotification, 
        ThemeManager, 
        CanvasUtils, 
        MathUtils, 
        EventUtils 
    };
}