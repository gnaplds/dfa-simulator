// baseAutomaton.js - Base class for all automaton types

class BaseAutomaton {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id '${canvasId}' not found`);
        }
        
        this.ctx = CanvasUtils.setupCanvas(this.canvas);
        
        // Common automaton properties
        this.states = [];
        this.transitions = [];
        this.selectedState = null;
        this.selectedTransition = null;
        this.hoveredTransition = null;
        this.hoveredState = null;
        this.startState = null;
        this.mode = 'state';
        this.transitionSource = null;
        this.stateCounter = 0;
        
        // Interaction properties
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.lastClickTime = 0;
        this.lastClickTarget = null;
        this.doubleClickDelay = 300;
        this.showLabels = true;
        this.draggingLabel = null;
        this.draggingSelfLoop = null;
        
        // Step debugging
        this.debugMode = false;
        this.debugString = '';
        this.debugSteps = [];
        this.currentDebugStep = -1;
        
        // Modal callbacks
        this.pendingRenameState = null;
        this.pendingTransitionData = null;
        
        this.setupEventListeners();
        this.draw();
    }

    setupEventListeners() {
        const handlers = {
            onDown: (x, y) => this.handleDown(x, y),
            onMove: (x, y) => this.handleMove(x, y),
            onUp: () => this.handleUp(),
            onHover: (x, y) => this.handleHover(x, y)
        };
        
        EventUtils.addTouchAndMouseListeners(this.canvas, handlers);
    }

    // Abstract methods to be implemented by subclasses
    validateTransition(fromState, toState, symbol) {
        throw new Error('validateTransition must be implemented by subclass');
    }

    simulateInput(input) {
        throw new Error('simulateInput must be implemented by subclass');
    }

    getAutomatonType() {
        throw new Error('getAutomatonType must be implemented by subclass');
    }

    // Common state management
    addState(x, y) {
        const state = {
            id: this.stateCounter++,
            x: x,
            y: y,
            isFinal: false,
            label: `q${this.stateCounter - 1}`
        };
        this.states.push(state);
        this.selectedState = state;
        
        if (this.states.length === 1) {
            this.startState = state;
        }
        
        this.draw();
        return state;
    }

    deleteState(state) {
        this.states = this.states.filter(s => s.id !== state.id);
        this.transitions = this.transitions.filter(t => 
            t.from.id !== state.id && t.to.id !== state.id
        );
        
        if (this.startState && this.startState.id === state.id) {
            this.startState = null;
        }
        
        this.selectedState = null;
        this.draw();
    }

    // Common transition management
    addTransition(from, to) {
        this.pendingTransitionData = { from, to };
        document.getElementById('transitionInput').value = '';
        document.getElementById('transitionModal').style.display = 'block';
        setTimeout(() => document.getElementById('transitionInput').focus(), 100);
    }

    confirmTransition() {
        const input = document.getElementById('transitionInput').value.trim();
        if (!input) {
            alert('Please enter at least one transition symbol!');
            return;
        }
        
        const symbols = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (symbols.length === 0) {
            alert('Please enter valid symbols!');
            return;
        }
        
        const { from, to, editingTransition } = this.pendingTransitionData;
        
        // Validate transition using subclass implementation
        try {
            this.validateTransition(from, to, symbols);
        } catch (error) {
            alert(error.message);
            return;
        }
        
        if (editingTransition) {
            // Editing existing transition
            editingTransition.symbol = symbols.join(', ');
        } else {
            this.createNewTransition(from, to, symbols);
        }
        
        document.getElementById('transitionModal').style.display = 'none';
        this.draw();
    }

    createNewTransition(from, to, symbols) {
        // Check if transition between these states already exists
        let existingTransition = this.transitions.find(t => 
            t.from.id === from.id && t.to.id === to.id
        );
        
        if (existingTransition) {
            // Add symbols to existing transition, avoiding duplicates
            const existingSymbols = existingTransition.symbol.split(',').map(s => s.trim());
            const newSymbols = symbols.filter(s => !existingSymbols.includes(s));
            
            if (newSymbols.length > 0) {
                existingTransition.symbol = [...existingSymbols, ...newSymbols].join(', ');
            } else {
                throw new Error('All symbols already exist for this transition!');
            }
        } else {
            // Create new transition
            const transition = {
                id: Date.now() + Math.random(),
                from: from,
                to: to,
                symbol: symbols.join(', ')
            };

            // Add positioning properties
            if (from.id === to.id) {
                // Self-loop
                transition.selfLoopAngle = -Math.PI/2; // Default to top
            } else {
                // Check if there's already a transition in the opposite direction
                const reverseTransition = this.transitions.find(t => 
                    t.from.id === to.id && t.to.id === from.id
                );
                
                if (reverseTransition) {
                    // Make both transitions offset with better spacing
                    transition.offset = -10;
                    reverseTransition.offset = 10;
                    transition.offsetDirection = 1;
                    reverseTransition.offsetDirection = -1;
                } else {
                    transition.labelOffset = 0.5; // Default to middle of transition
                }
            }

            this.transitions.push(transition);
        }
    }

    deleteTransition(transition) {
        // If deleting an offset transition, remove offset from its reverse
        const reverse = this.transitions.find(t => 
            t.from.id === transition.to.id && 
            t.to.id === transition.from.id &&
            t.offset
        );
        if (reverse) {
            reverse.offset = 0;
            reverse.offsetDirection = 0;
            reverse.labelOffset = 0.5;
        }
        
        this.transitions = this.transitions.filter(t => t.id !== transition.id);
        this.selectedTransition = null;
        this.draw();
    }

    // Interaction handlers
    handleDown(x, y) {
        const clickedState = this.getStateAt(x, y);
        const clickedTransition = this.getTransitionAt(x, y);
        const clickedLabel = this.getLabelAt(x, y);
        const clickedSelfLoop = this.getSelfLoopDragArea(x, y);
        const currentTime = Date.now();
        
        // Check for double click
        if (currentTime - this.lastClickTime < this.doubleClickDelay) {
            if (clickedState && this.lastClickTarget === clickedState) {
                this.renameState(clickedState);
                return;
            } else if (clickedTransition && this.lastClickTarget === clickedTransition) {
                this.editTransitionSymbol(clickedTransition);
                return;
            }
        }
        
        this.lastClickTime = currentTime;
        this.lastClickTarget = clickedState || clickedTransition;
        
        // Reset selections
        this.selectedTransition = null;
        this.draggingLabel = null;
        this.draggingSelfLoop = null;
        
        if (this.mode === 'state') {
            if (!clickedState) {
                this.addState(x, y);
            } else {
                this.selectedState = clickedState;
            }
        } else if (this.mode === 'transition') {
            if (clickedState) {
                if (!this.transitionSource) {
                    this.transitionSource = clickedState;
                } else {
                    this.addTransition(this.transitionSource, clickedState);
                    this.transitionSource = null;
                }
            }
        } else if (this.mode === 'move') {
            if (clickedLabel) {
                this.draggingLabel = clickedLabel;
            } else if (clickedSelfLoop) {
                this.draggingSelfLoop = clickedSelfLoop;
            } else if (clickedTransition) {
                this.selectedTransition = clickedTransition;
            } else if (clickedState) {
                this.selectedState = clickedState;
                this.isDragging = true;
                this.dragOffset.x = x - clickedState.x;
                this.dragOffset.y = y - clickedState.y;
            }
        }
        
        this.draw();
    }

    handleMove(x, y) {
        if (this.isDragging && this.selectedState && this.mode === 'move') {
            this.selectedState.x = x - this.dragOffset.x;
            this.selectedState.y = y - this.dragOffset.y;
            this.draw();
        } else if (this.draggingLabel && this.mode === 'move') {
            this.moveLabelAlongTransition(this.draggingLabel, x, y);
            this.draw();
        } else if (this.draggingSelfLoop && this.mode === 'move') {
            this.moveSelfLoop(this.draggingSelfLoop, x, y);
            this.draw();
        }
    }

    handleUp() {
        this.isDragging = false;
        this.draggingLabel = null;
        this.draggingSelfLoop = null;
    }

    handleHover(x, y) {
        const hoveredTransition = this.getTransitionAt(x, y);
        const hoveredState = this.getStateAt(x, y);
        
        if (hoveredTransition !== this.hoveredTransition) {
            this.hoveredTransition = hoveredTransition;
            this.draw();
        }
        
        if (hoveredState !== this.hoveredState) {
            this.hoveredState = hoveredState;
            // Update cursor based on mode and hover state
            if (this.mode === 'move' && (hoveredState || this.getLabelAt(x, y) || this.getSelfLoopDragArea(x, y))) {
                this.canvas.style.cursor = 'move';
            } else {
                this.canvas.style.cursor = 'crosshair';
            }
            this.draw();
        }
    }

    // Hit detection methods
    getStateAt(x, y) {
        const radius = 30;
        return this.states.find(state => {
            return MathUtils.distance(x, y, state.x, state.y) <= radius;
        });
    }

    getTransitionAt(x, y) {
        const tolerance = 15;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                // Self-loop detection
                if (this.isPointOnSelfLoop(x, y, transition, tolerance)) {
                    return transition;
                }
            } else if (transition.offset) {
                // Offset transition detection
                if (this.isPointOnOffsetTransition(x, y, transition, tolerance)) {
                    return transition;
                }
            } else {
                // Regular straight transition
                if (this.isPointOnStraightTransition(x, y, transition, tolerance)) {
                    return transition;
                }
            }
        }
        return null;
    }

    isPointOnSelfLoop(x, y, transition, tolerance) {
        const state = transition.from;
        const angle = transition.selfLoopAngle || -Math.PI/2;
        const loopDistance = 40;
        const loopRadius = 20;
        
        const loopCenterX = state.x + Math.cos(angle) * loopDistance;
        const loopCenterY = state.y + Math.sin(angle) * loopDistance;
        
        const distance = MathUtils.distance(x, y, loopCenterX, loopCenterY);
        return Math.abs(distance - loopRadius) < tolerance;
    }

    isPointOnStraightTransition(x, y, transition, tolerance) {
        const from = transition.from;
        const to = transition.to;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) return false;
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        const radius = 30;
        const startX = from.x + unitX * radius;
        const startY = from.y + unitY * radius;
        const endX = to.x - unitX * radius;
        const endY = to.y - unitY * radius;
        
        const distToLine = MathUtils.pointToLineDistance(x, y, startX, startY, endX, endY);
        
        const dotProduct = (x - startX) * (endX - startX) + (y - startY) * (endY - startY);
        const squaredLength = (endX - startX) * (endX - startX) + (endY - startY) * (endY - startY);
        const param = dotProduct / squaredLength;
        
        return distToLine < tolerance && param >= 0 && param <= 1;
    }

    isPointOnOffsetTransition(x, y, transition, tolerance) {
        const from = transition.from;
        const to = transition.to;
        const offsetDistance = transition.offset || 0;
        const offsetDirection = transition.offsetDirection || 0;
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) return false;
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        const perpX = -unitY * offsetDistance * offsetDirection;
        const perpY = unitX * offsetDistance * offsetDirection;
        
        const radius = 30;
        const startX = from.x + unitX * radius + perpX;
        const startY = from.y + unitY * radius + perpY;
        const endX = to.x - unitX * radius + perpX;
        const endY = to.y - unitY * radius + perpY;
        
        const distToLine = MathUtils.pointToLineDistance(x, y, startX, startY, endX, endY);
        
        const dotProduct = (x - startX) * (endX - startX) + (y - startY) * (endY - startY);
        const squaredLength = (endX - startX) * (endX - startX) + (endY - startY) * (endY - startY);
        const param = dotProduct / squaredLength;
        
        return distToLine < tolerance && param >= 0 && param <= 1;
    }

    // Label and self-loop manipulation
    getLabelAt(x, y) {
        if (!this.showLabels) return null;

        const tolerance = 20;
        
        for (let transition of this.transitions) {
            const labelPos = this.getTransitionLabelPosition(transition);
            if (labelPos) {
                const distance = MathUtils.distance(x, y, labelPos.x, labelPos.y);
                
                if (distance < tolerance) {
                    return { 
                        transition: transition, 
                        type: transition.from.id === transition.to.id ? 'selfLoop' : 
                              (transition.offset ? 'offset' : 'regular')
                    };
                }
            }
        }
        return null;
    }

    getSelfLoopDragArea(x, y) {
        const tolerance = 20;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                if (this.isPointOnSelfLoop(x, y, transition, tolerance)) {
                    return transition;
                }
            }
        }
        return null;
    }

    moveLabelAlongTransition(labelInfo, x, y) {
        const transition = labelInfo.transition;
        
        if (labelInfo.type === 'selfLoop') {
            this.moveSelfLoop(transition, x, y);
        } else {
            // Calculate new label position along transition
            const from = transition.from;
            const to = transition.to;
            
            let startX, startY, endX, endY;
            
            if (transition.offset) {
                // For offset transitions
                const offsetDistance = transition.offset || 0;
                const offsetDirection = transition.offsetDirection || 0;
                
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) return;
                
                const unitX = dx / distance;
                const unitY = dy / distance;
                const perpX = -unitY * offsetDistance * offsetDirection;
                const perpY = unitX * offsetDistance * offsetDirection;
                
                const radius = 30;
                startX = from.x + unitX * radius + perpX;
                startY = from.y + unitY * radius + perpY;
                endX = to.x - unitX * radius + perpX;
                endY = to.y - unitY * radius + perpY;
            } else {
                // For regular straight transitions
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) return;
                
                const unitX = dx / distance;
                const unitY = dy / distance;
                const radius = 30;
                startX = from.x + unitX * radius;
                startY = from.y + unitY * radius;
                endX = to.x - unitX * radius;
                endY = to.y - unitY * radius;
            }
            
            // Project mouse position onto line
            const lineVecX = endX - startX;
            const lineVecY = endY - startY;
            const mouseVecX = x - startX;
            const mouseVecY = y - startY;
            
            const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);
            const projection = (mouseVecX * lineVecX + mouseVecY * lineVecY) / (lineLength * lineLength);
            
            transition.labelOffset = MathUtils.clamp(projection, 0, 1);
        }
    }

    moveSelfLoop(transition, x, y) {
        const state = transition.from;
        const dx = x - state.x;
        const dy = y - state.y;
        const angle = Math.atan2(dy, dx);
        transition.selfLoopAngle = angle;
    }

    getTransitionLabelPosition(transition) {
        if (transition.from.id === transition.to.id) {
            // Self-loop label
            const state = transition.from;
            const angle = transition.selfLoopAngle || -Math.PI/2;
            const labelDistance = 50;
            
            return {
                x: state.x + Math.cos(angle) * labelDistance,
                y: state.y + Math.sin(angle) * labelDistance
            };
        } else if (transition.offset) {
            // Offset transition label
            const from = transition.from;
            const to = transition.to;
            const offsetDistance = transition.offset || 0;
            const offsetDirection = transition.offsetDirection || 0;
            
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 10) return null;
            
            const unitX = dx / distance;
            const unitY = dy / distance;
            const perpX = -unitY * offsetDistance * offsetDirection;
            const perpY = unitX * offsetDistance * offsetDirection;
            
            const radius = 30;
            const startX = from.x + unitX * radius + perpX;
            const startY = from.y + unitY * radius + perpY;
            const endX = to.x - unitX * radius + perpX;
            const endY = to.y - unitY * radius + perpY;
            
            const t = transition.labelOffset || 0.5;
            return {
                x: startX + (endX - startX) * t,
                y: startY + (endY - startY) * t
            };
        } else {
            // Regular straight transition
            const from = transition.from;
            const to = transition.to;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 10) return null;
            
            const unitX = dx / distance;
            const unitY = dy / distance;
            const radius = 30;
            const startX = from.x + unitX * radius;
            const startY = from.y + unitY * radius;
            const endX = to.x - unitX * radius;
            const endY = to.y - unitY * radius;
            
            const t = transition.labelOffset || 0.5;
            return {
                x: startX + (endX - startX) * t,
                y: startY + (endY - startY) * t
            };
        }
    }

    // Modal operations
    renameState(state) {
        this.pendingRenameState = state;
        document.getElementById('renameInput').value = state.label;
        document.getElementById('renameModal').style.display = 'block';
        setTimeout(() => document.getElementById('renameInput').focus(), 100);
    }
    
    confirmRename() {
        const newName = document.getElementById('renameInput').value.trim();
        if (newName && this.pendingRenameState) {
            this.pendingRenameState.label = newName;
            document.getElementById('renameModal').style.display = 'none';
            this.draw();
        }
    }
    
    editTransitionSymbol(transition) {
        this.pendingTransitionData = { 
            from: transition.from, 
            to: transition.to, 
            editingTransition: transition 
        };
        document.getElementById('transitionInput').value = transition.symbol;
        document.getElementById('transitionModal').style.display = 'block';
        setTimeout(() => document.getElementById('transitionInput').focus(), 100);
    }

    // Mode and state management
    setMode(newMode) {
        this.mode = newMode;
        this.transitionSource = null;
        this.selectedTransition = null;
        document.getElementById('modeIndicator').textContent = `Mode: ${newMode.charAt(0).toUpperCase() + newMode.slice(1)}`;
        this.draw();
    }
    
    setStartState() {
        if (this.selectedState) {
            this.startState = this.selectedState;
            this.draw();
        } else {
            alert('Please select a state first!');
        }
    }
    
    toggleFinalState() {
        if (this.selectedState) {
            this.selectedState.isFinal = !this.selectedState.isFinal;
            this.draw();
        } else {
            alert('Please select a state first!');
        }
    }
    
    deleteSelected() {
        if (this.selectedTransition || this.selectedState) {
            document.getElementById('deleteModal').style.display = 'block';
        } else {
            alert('Please select a state or transition first!');
        }
    }
    
    confirmDelete() {
        if (this.selectedTransition) {
            this.deleteTransition(this.selectedTransition);
        } else if (this.selectedState) {
            this.deleteState(this.selectedState);
        }
        
        document.getElementById('deleteModal').style.display = 'none';
    }
    
    clearAll() {
        document.getElementById('clearModal').style.display = 'block';
    }
    
    confirmClearAll() {
        this.states = [];
        this.transitions = [];
        this.selectedState = null;
        this.selectedTransition = null;
        this.startState = null;
        this.transitionSource = null;
        this.stateCounter = 0;
        this.resetDebug();
        document.getElementById('clearModal').style.display = 'none';
        this.draw();
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        const toggle = document.getElementById('labelToggle');
        if (this.showLabels) {
            toggle.classList.add('active');
        } else {
            toggle.classList.remove('active');
        }
        this.draw();
    }

    // Debugging methods (to be implemented by subclasses)
    resetDebug() {
        this.debugMode = false;
        this.currentDebugStep = -1;
        this.debugSteps = [];
        const debuggerist = document.getElementById('stepDebugger');
        if (debuggerist) {
            debuggerist.style.display = 'none';
        }
        this.draw();
    }

    // Drawing methods (to be implemented by subclasses for specific rendering)
    draw() {
        throw new Error('draw must be implemented by subclass');
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseAutomaton;
}