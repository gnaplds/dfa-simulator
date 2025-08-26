// dataManager.js - Firebase and URL management

class AutomatonDataManager {
    constructor() {
        this.lastShareTime = 0;
        this.SHARE_COOLDOWN = 3000; // 3 seconds between shares
        this.MAX_DFA_SIZE = 25000; // 25KB max size
        this.MAX_RETRIES = 3;
        this.ID_LENGTH = 8;
    }

    // Check if Firebase is properly configured
    isFirebaseAvailable() {
        return !!(window.firebaseDb && window.firebaseDoc && 
                 window.firebaseSetDoc && window.firebaseGetDoc);
    }

    // Generate unique ID with collision detection
    async generateUniqueShortId() {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase not available');
        }

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            const shortId = MathUtils.generateSecureId(this.ID_LENGTH);
            
            try {
                const docRef = window.firebaseDoc(window.firebaseDb, 'automatons', shortId);
                const docSnap = await window.firebaseGetDoc(docRef);
                
                if (!docSnap.exists()) {
                    return shortId;
                }
            } catch (error) {
                console.warn(`ID generation attempt ${attempt + 1} failed:`, error);
                if (attempt === this.MAX_RETRIES - 1) throw error;
            }
        }
        throw new Error('Could not generate unique ID after multiple attempts');
    }

    // Sanitize user input data
    sanitizeString(str, maxLength = 50) {
        if (typeof str !== 'string') return '';
        return str.slice(0, maxLength)
                 .replace(/[<>'"&]/g, '') // Remove potentially dangerous characters
                 .trim();
    }

    // Validate automaton data structure
    validateAutomatonData(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid automaton data structure');
        }

        if (!Array.isArray(data.states)) {
            throw new Error('States must be an array');
        }

        if (!Array.isArray(data.transitions)) {
            throw new Error('Transitions must be an array');
        }

        // Validate data size
        const dataSize = JSON.stringify(data).length;
        if (dataSize > this.MAX_DFA_SIZE) {
            throw new Error(`Automaton too large (${dataSize} bytes, max ${this.MAX_DFA_SIZE})`);
        }

        // Validate states
        data.states.forEach((state, index) => {
            if (typeof state.id !== 'number') {
                throw new Error(`State ${index} has invalid ID`);
            }
            if (typeof state.x !== 'number' || typeof state.y !== 'number') {
                throw new Error(`State ${index} has invalid coordinates`);
            }
        });

        // Validate transitions
        data.transitions.forEach((transition, index) => {
            if (typeof transition.fromId !== 'number' || typeof transition.toId !== 'number') {
                throw new Error(`Transition ${index} has invalid state references`);
            }
            if (!transition.symbol || typeof transition.symbol !== 'string') {
                throw new Error(`Transition ${index} has invalid symbol`);
            }
        });

        return true;
    }

    // Sanitize loaded automaton data
    sanitizeAutomatonData(data) {
        return {
            type: data.type || 'dfa',
            states: data.states.map(state => ({
                id: parseInt(state.id) || 0,
                x: MathUtils.clamp(parseInt(state.x) || 100, 0, 2000),
                y: MathUtils.clamp(parseInt(state.y) || 100, 0, 1000),
                isFinal: Boolean(state.isFinal),
                label: this.sanitizeString(state.label || `q${state.id}`, 20)
            })),
            transitions: data.transitions.map(transition => ({
                id: transition.id || Date.now() + Math.random(),
                fromId: parseInt(transition.fromId) || 0,
                toId: parseInt(transition.toId) || 0,
                symbol: this.sanitizeString(transition.symbol || 'a', 10),
                offset: MathUtils.clamp(parseFloat(transition.offset) || 0, -50, 50),
                offsetDirection: MathUtils.clamp(parseInt(transition.offsetDirection) || 0, -1, 1),
                labelOffset: MathUtils.clamp(parseFloat(transition.labelOffset) || 0.5, 0, 1),
                selfLoopAngle: parseFloat(transition.selfLoopAngle) || -Math.PI/2
            })),
            startStateId: transition.startStateId !== null ? parseInt(data.startStateId) : null,
            stateCounter: Math.max(0, parseInt(data.stateCounter) || 0)
        };
    }

    // Save automaton to Firebase
    async saveAutomatonToFirebase(automatonData) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase not available');
        }

        // Validate data before saving
        this.validateAutomatonData(automatonData);

        try {
            const shortId = await this.generateUniqueShortId();
            const docRef = window.firebaseDoc(window.firebaseDb, 'automatons', shortId);
            
            const documentData = {
                automatonData: automatonData,
                createdAt: new Date().toISOString(),
                version: '2.0',
                userAgent: navigator.userAgent.slice(0, 100)
            };

            await window.firebaseSetDoc(docRef, documentData);
            return shortId;

        } catch (error) {
            console.error('Firebase save failed:', error);
            
            // Provide user-friendly error messages
            if (error.code === 'permission-denied') {
                throw new Error('Access denied. Please try again later.');
            } else if (error.code === 'unavailable') {
                throw new Error('Service temporarily unavailable. Please try again.');
            } else if (error.message.includes('quota')) {
                throw new Error('Service temporarily at capacity. Please try again later.');
            } else {
                throw new Error('Failed to save automaton. Please try again.');
            }
        }
    }

    // Load automaton from Firebase
    async loadAutomatonFromFirebase(shortId) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase not configured');
        }

        // Validate shortId format
        if (!/^[A-Za-z0-9]{6,10}$/.test(shortId)) {
            throw new Error('Invalid link format');
        }

        try {
            const docRef = window.firebaseDoc(window.firebaseDb, 'automatons', shortId);
            const docSnap = await window.firebaseGetDoc(docRef);
            
            if (!docSnap.exists()) {
                throw new Error('Automaton not found. Link may be invalid or expired.');
            }

            const data = docSnap.data();
            
            // Check for both new and old document formats
            const automatonData = data.automatonData || data.dfaData;
            if (!automatonData) {
                throw new Error('Invalid document format');
            }

            // Sanitize data before loading
            const sanitizedData = this.sanitizeAutomatonData(automatonData);
            return sanitizedData;

        } catch (error) {
            console.error('Error loading from Firebase:', error);
            
            if (error.message.includes('not found') || error.message.includes('expired')) {
                throw error; // Re-throw user-friendly messages
            } else if (error.code === 'permission-denied') {
                throw new Error('Access denied');
            } else {
                throw new Error('Failed to load automaton from server');
            }
        }
    }

    // Enhanced clipboard function
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
            } else {
                // Fallback for older browsers or non-secure contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                textArea.style.pointerEvents = 'none';
                document.body.appendChild(textArea);
                textArea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (!successful) {
                    throw new Error('Copy command failed');
                }
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            throw new Error('Failed to copy to clipboard');
        }
    }

    // Enhanced URL encoding with rate limiting
    async encodeAutomatonToURL(simulator) {
        // Rate limiting
        const now = Date.now();
        if (now - this.lastShareTime < this.SHARE_COOLDOWN) {
            const remainingTime = Math.ceil((this.SHARE_COOLDOWN - (now - this.lastShareTime)) / 1000);
            throw new Error(`Please wait ${remainingTime} seconds before sharing again`);
        }

        if (!simulator || !simulator.states || simulator.states.length === 0) {
            throw new Error('Please create some states first');
        }

        this.lastShareTime = now;

        const automatonData = {
            type: 'dfa', // Can be extended for NFA, PDA, TM
            states: simulator.states.map(state => ({
                id: state.id,
                x: Math.round(state.x),
                y: Math.round(state.y),
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

        try {
            // Try Firebase first if available
            if (this.isFirebaseAvailable()) {
                try {
                    const shortId = await this.saveAutomatonToFirebase(automatonData);
                    const currentURL = window.location.href.split('?')[0];
                    const shareURL = `${currentURL}?id=${shortId}`;
                    
                    await this.copyToClipboard(shareURL);
                    return { success: true, url: shareURL, type: 'firebase' };
                } catch (firebaseError) {
                    console.warn('Firebase failed, falling back to direct encoding:', firebaseError);
                    // Continue to fallback method
                }
            }

            // Fallback to direct URL encoding
            const jsonString = JSON.stringify(automatonData);
            
            // Use base64url encoding (URL-safe)
            const encodedData = btoa(jsonString)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            
            const currentURL = window.location.href.split('?')[0];
            const shareURL = `${currentURL}?dfa=${encodedData}`;
            
            // Check URL length
            if (shareURL.length > 2000) {
                throw new Error('Automaton too complex for direct URL sharing');
            }
            
            await this.copyToClipboard(shareURL);
            return { success: true, url: shareURL, type: 'direct' };

        } catch (error) {
            console.error('Error creating shareable link:', error);
            throw new Error(`Failed to create shareable link: ${error.message}`);
        }
    }

    // Load automaton from URL
    loadAutomatonFromURL(simulator) {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('dfa');
        const shortId = urlParams.get('id');
        
        // Handle Firebase short URLs
        if (shortId) {
            this.loadAutomatonFromFirebase(shortId)
                .then((data) => {
                    this.loadAutomatonIntoSimulator(data, simulator);
                    showNotification('Automaton loaded successfully!', 'success');
                })
                .catch(error => {
                    console.error('Failed to load automaton:', error);
                    showNotification(error.message, 'error');
                })
                .finally(() => {
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                });
            return;
        }

        // Handle direct encoded URLs
        if (!encodedData) return;

        try {
            // Handle both regular base64 and base64url encoding
            let jsonString;
            try {
                jsonString = atob(encodedData.replace(/-/g, '+').replace(/_/g, '/'));
            } catch {
                // Try without replacement for backward compatibility
                jsonString = atob(encodedData);
            }

            const automatonData = JSON.parse(jsonString);
            const sanitizedData = this.sanitizeAutomatonData(automatonData);
            
            this.loadAutomatonIntoSimulator(sanitizedData, simulator);
            showNotification('Automaton loaded successfully!', 'success');

        } catch (error) {
            console.error('Error loading automaton from URL:', error);
            showNotification('Invalid or corrupted automaton link', 'error');
        } finally {
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    // Load automaton data into simulator
    loadAutomatonIntoSimulator(automatonData, simulator) {
        try {
            // Validate data structure
            this.validateAutomatonData(automatonData);

            // Clear current automaton
            simulator.states = [];
            simulator.transitions = [];
            simulator.selectedState = null;
            simulator.selectedTransition = null;
            simulator.startState = null;
            simulator.transitionSource = null;
            if (simulator.resetDebug) {
                simulator.resetDebug();
            }

            // Restore states
            const stateMap = new Map();
            automatonData.states.forEach(stateData => {
                const state = {
                    id: stateData.id,
                    x: stateData.x,
                    y: stateData.y,
                    isFinal: stateData.isFinal,
                    label: stateData.label
                };
                simulator.states.push(state);
                stateMap.set(stateData.id, state);
            });

            // Restore transitions
            automatonData.transitions.forEach(transitionData => {
                const fromState = stateMap.get(transitionData.fromId);
                const toState = stateMap.get(transitionData.toId);
                
                if (fromState && toState) {
                    const transition = {
                        id: transitionData.id || (Date.now() + Math.random()),
                        from: fromState,
                        to: toState,
                        symbol: transitionData.symbol,
                        offset: transitionData.offset || 0,
                        offsetDirection: transitionData.offsetDirection || 0,
                        labelOffset: transitionData.labelOffset || 0.5,
                        selfLoopAngle: transitionData.selfLoopAngle || -Math.PI/2
                    };
                    simulator.transitions.push(transition);
                } else {
                    console.warn('Skipping transition with invalid state references:', transitionData);
                }
            });

            // Restore start state
            if (automatonData.startStateId !== null && automatonData.startStateId !== undefined) {
                simulator.startState = stateMap.get(automatonData.startStateId);
                if (!simulator.startState) {
                    console.warn('Start state not found, clearing start state reference');
                }
            }

            // Restore counter
            simulator.stateCounter = Math.max(automatonData.stateCounter || 0, simulator.states.length);

            if (simulator.draw) {
                simulator.draw();
            }

        } catch (error) {
            console.error('Error loading automaton data:', error);
            throw new Error(`Failed to load automaton: ${error.message}`);
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AutomatonDataManager;
}