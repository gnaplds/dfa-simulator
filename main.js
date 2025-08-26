// main.js - Main application controller and global functions

// Global variables
let simulator;
let dataManager;

// Initialize the application
window.addEventListener('load', () => {
    try {
        simulator = new DFASimulator('canvas');
        dataManager = new AutomatonDataManager();
        
        // Initialize theme
        ThemeManager.initializeTheme();
        
        // Load DFA from URL if present
        dataManager.loadAutomatonFromURL(simulator);
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('DFA Simulator initialized successfully');
    } catch (error) {
        console.error('Failed to initialize DFA Simulator:', error);
        showNotification('Failed to initialize application', 'error');
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (simulator) {
        simulator.ctx = CanvasUtils.setupCanvas(simulator.canvas);
        simulator.draw();
    }
});

// Setup additional event listeners
function setupEventListeners() {
    // Test input enter key
    const testInput = document.getElementById('testInput');
    if (testInput) {
        testInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                testString();
            }
        });
    }

    // Modal close on outside click
    window.addEventListener('click', (event) => {
        const modals = ['deleteModal', 'clearModal', 'transitionModal', 'renameModal'];
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Escape key to close modals
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            const modals = ['deleteModal', 'clearModal', 'transitionModal', 'renameModal'];
            modals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal && modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        }
    });

    // Enter key for modal confirmations
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            // Check which modal is open and confirm
            if (document.getElementById('transitionModal')?.style.display === 'block') {
                confirmTransition();
            } else if (document.getElementById('renameModal')?.style.display === 'block') {
                confirmRename();
            }
        }
    });
}

// Global control functions (called by HTML buttons)
function setMode(mode) {
    if (simulator) {
        simulator.setMode(mode);
    }
}

function setStartState() {
    if (simulator) {
        simulator.setStartState();
    }
}

function toggleFinalState() {
    if (simulator) {
        simulator.toggleFinalState();
    }
}

function deleteSelected() {
    if (simulator) {
        simulator.deleteSelected();
    }
}

function clearAll() {
    if (simulator) {
        simulator.clearAll();
    }
}

function confirmTransition() {
    if (simulator) {
        simulator.confirmTransition();
    }
}

function confirmRename() {
    if (simulator) {
        simulator.confirmRename();
    }
}

function confirmDelete() {
    if (simulator) {
        simulator.confirmDelete();
    }
}

function confirmClearAll() {
    if (simulator) {
        simulator.confirmClearAll();
    }
}

function toggleLabels() {
    if (simulator) {
        simulator.toggleLabels();
    }
}

function testString() {
    if (simulator) {
        simulator.testString();
    }
}

function startStepDebug() {
    if (simulator) {
        simulator.startStepDebug();
    }
}

function stepNext() {
    if (simulator) {
        simulator.stepNext();
    }
}

function stepPrev() {
    if (simulator) {
        simulator.stepPrev();
    }
}

function resetDebug() {
    if (simulator) {
        simulator.resetDebug();
    }
}

function runBulkTest() {
    if (simulator) {
        simulator.runBulkTest();
    }
}

// Tab switching
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab + '-test').classList.add('active');
}

// Modal management
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Theme toggle
function toggleTheme() {
    ThemeManager.toggleTheme();
}

// Navigation
function scrollToInstructions() {
    const instructions = document.getElementById('instructions');
    if (instructions) {
        instructions.scrollIntoView({ behavior: 'smooth' });
    }
}

// Sharing functionality
async function encodeDFAToURL() {
    try {
        if (!simulator || !dataManager) {
            throw new Error('Application not initialized');
        }
        
        showNotification('Creating shareable link...', 'info');
        const result = await dataManager.encodeAutomatonToURL(simulator);
        
        const message = result.type === 'firebase' 
            ? 'Short link copied to clipboard!' 
            : 'Link copied to clipboard!';
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('Share failed:', error);
        showNotification(error.message, 'error');
    }
}

// Load DFA from URL (called during initialization)
function loadDFAFromURL() {
    if (dataManager && simulator) {
        dataManager.loadAutomatonFromURL(simulator);
    }
}

// Export/Import functionality (future enhancement)
function exportDFA() {
    if (!simulator || simulator.states.length === 0) {
        showNotification('No DFA to export', 'error');
        return;
    }
    
    try {
        const automatonData = {
            type: 'dfa',
            states: simulator.states.map(state => ({
                id: state.id,
                x: state.x,
                y: state.y,
                isFinal: state.isFinal,
                label: state.label
            })),
            transitions: simulator.transitions.map(transition => ({
                id: transition.id,
                fromId: transition.from.id,
                toId: transition.to.id,
                symbol: transition.symbol,
                offset: transition.offset || 0,
                offsetDirection: transition.offsetDirection || 0,
                labelOffset: transition.labelOffset || 0.5,
                selfLoopAngle: transition.selfLoopAngle || -Math.PI/2
            })),
            startStateId: simulator.startState ? simulator.startState.id : null,
            stateCounter: simulator.stateCounter
        };
        
        const dataStr = JSON.stringify(automatonData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'dfa_automaton.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        showNotification('DFA exported successfully', 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Failed to export DFA', 'error');
    }
}

function importDFA() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const automatonData = JSON.parse(e.target.result);
                const sanitizedData = dataManager.sanitizeAutomatonData(automatonData);
                dataManager.loadAutomatonIntoSimulator(sanitizedData, simulator);
                showNotification('DFA imported successfully', 'success');
            } catch (error) {
                console.error('Import failed:', error);
                showNotification('Invalid DFA file format', 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

// Error handling for uncaught errors
window.addEventListener('error', (event) => {
    console.error('Uncaught error:', event.error);
    showNotification('An unexpected error occurred', 'error');
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred', 'error');
});

// Development helpers (remove in production)
if (typeof window !== 'undefined') {
    window.debugSimulator = () => simulator;
    window.debugDataManager = () => dataManager;
}