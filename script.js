// script.js
class DFASimulator {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
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
        
        this.setupCanvas();
        this.setupEventListeners();
        this.draw();
    }

    // Get current theme colors from CSS variables
    getThemeColors() {
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
    
    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    setupEventListeners() {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleDown(x, y);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleMove(x, y);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleUp();
        });
        
        // Mouse events for desktop
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleDown(x, y);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleMove(x, y);
            this.handleHover(x, y);
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.handleUp();
        });
        
        // Context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Prevent scrolling on canvas
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
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
    }
    
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
        
        // Check if symbols are single characters
        for (let symbol of symbols) {
            if (symbol.length !== 1) {
                alert('Each symbol must be exactly one character!');
                return;
            }
        }
        
        const { from, to, editingTransition } = this.pendingTransitionData;
        
        if (editingTransition) {
            // Editing existing transition - simply replace the symbols
            editingTransition.symbol = symbols.join(', ');
        } else {
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
                    alert('All symbols already exist for this transition!');
                    return;
                }
            } else {
                // Enforce DFA rule: no duplicate symbol from the same state
                for (let symbol of symbols) {
                    const duplicate = this.transitions.find(t => 
                        t.from.id === from.id && 
                        t.symbol.split(',').map(s => s.trim()).includes(symbol)
                    );
                    if (duplicate) {
                        alert(`DFA rule violation: State '${from.label}' already has a transition for symbol '${symbol}'!`);
                        return;
                    }
                }

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
        
        document.getElementById('transitionModal').style.display = 'none';
        this.draw();
    }
    
    getStateAt(x, y) {
        const radius = 30;
        return this.states.find(state => {
            const dx = x - state.x;
            const dy = y - state.y;
            return Math.sqrt(dx * dx + dy * dy) <= radius;
        });
    }

    getLabelAt(x, y) {
        if (!this.showLabels) return null;

        const tolerance = 20;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                // Self-loop label
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                const labelDistance = 50;
                
                const labelX = state.x + Math.cos(angle) * labelDistance;
                const labelY = state.y + Math.sin(angle) * labelDistance;
                
                const dx = x - labelX;
                const dy = y - labelY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < tolerance) {
                    return { transition: transition, type: 'selfLoop' };
                }
            } else {
                // Regular and offset transition labels
                const labelPos = this.getTransitionLabelPosition(transition);
                if (labelPos) {
                    const labelDx = x - labelPos.x;
                    const labelDy = y - labelPos.y;
                    const labelDistance = Math.sqrt(labelDx * labelDx + labelDy * labelDy);
                    
                    if (labelDistance < tolerance) {
                        return { transition: transition, type: transition.offset ? 'offset' : 'regular' };
                    }
                }
            }
        }
        return null;
    }

    getSelfLoopDragArea(x, y) {
        const tolerance = 20; // Fixed tolerance - closer to actual loop
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                const loopDistance = 40;
                const loopRadius = 20;
                
                const loopCenterX = state.x + Math.cos(angle) * loopDistance;
                const loopCenterY = state.y + Math.sin(angle) * loopDistance;
                
                const dx = x - loopCenterX;
                const dy = y - loopCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Check if point is on the loop circle (within tolerance of the circumference)
                if (Math.abs(distance - loopRadius) < tolerance) {
                    return transition;
                }
            }
        }
        return null;
    }

    moveLabelAlongTransition(labelInfo, x, y) {
        const transition = labelInfo.transition;
        
        if (labelInfo.type === 'selfLoop') {
            // For self-loops, moving the label moves the entire loop
            this.moveSelfLoop(transition, x, y);
        } else if (labelInfo.type === 'regular' || labelInfo.type === 'offset') {
            // For both regular and offset transitions, move label along the line
            const from = transition.from;
            const to = transition.to;
            
            if (transition.offset) {
                // For offset transitions, calculate the offset line
                const offsetDistance = transition.offset || 0;
                const offsetDirection = transition.offsetDirection || 0;
                
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) return;
                
                // Calculate perpendicular offset
                const unitX = dx / distance;
                const unitY = dy / distance;
                const perpX = -unitY * offsetDistance * offsetDirection;
                const perpY = unitX * offsetDistance * offsetDirection;
                
                const radius = 30;
                const startX = from.x + unitX * radius + perpX;
                const startY = from.y + unitY * radius + perpY;
                const endX = to.x - unitX * radius + perpX;
                const endY = to.y - unitY * radius + perpY;
                
                // Project mouse position onto offset line
                const lineVecX = endX - startX;
                const lineVecY = endY - startY;
                const mouseVecX = x - startX;
                const mouseVecY = y - startY;
                
                const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);
                const projection = (mouseVecX * lineVecX + mouseVecY * lineVecY) / (lineLength * lineLength);
                
                // Clamp between 0 and 1
                transition.labelOffset = Math.max(0, Math.min(1, projection));
            } else {
                // For regular straight transitions
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) return;
                
                const unitX = dx / distance;
                const unitY = dy / distance;
                const radius = 30;
                const startX = from.x + unitX * radius;
                const startY = from.y + unitY * radius;
                const endX = to.x - unitX * radius;
                const endY = to.y - unitY * radius;
                
                // Project onto line
                const lineVecX = endX - startX;
                const lineVecY = endY - startY;
                const mouseVecX = x - startX;
                const mouseVecY = y - startY;
                
                const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);
                const projection = (mouseVecX * lineVecX + mouseVecY * lineVecY) / (lineLength * lineLength);
                
                // Clamp between 0 and 1
                transition.labelOffset = Math.max(0, Math.min(1, projection));
            }
        }
    }

    moveSelfLoop(transition, x, y) {
        const state = transition.from;
        const dx = x - state.x;
        const dy = y - state.y;
        const angle = Math.atan2(dy, dx);
        transition.selfLoopAngle = angle;
    }
    
    getTransitionAt(x, y) {
        const tolerance = 15;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                // Self-loop - check the actual loop circle
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                const loopDistance = 40;
                const loopRadius = 20;
                
                const loopCenterX = state.x + Math.cos(angle) * loopDistance;
                const loopCenterY = state.y + Math.sin(angle) * loopDistance;
                
                const dx = x - loopCenterX;
                const dy = y - loopCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (Math.abs(distance - loopRadius) < tolerance) {
                    return transition;
                }
            } else if (transition.offset) {
                // Offset transition detection
                if (this.isPointOnOffsetTransition(x, y, transition, tolerance)) {
                    return transition;
                }
            } else {
                // Regular straight transition
                const from = transition.from;
                const to = transition.to;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 10) continue;
                
                const unitX = dx / distance;
                const unitY = dy / distance;
                const radius = 30;
                const startX = from.x + unitX * radius;
                const startY = from.y + unitY * radius;
                const endX = to.x - unitX * radius;
                const endY = to.y - unitY * radius;
                
                // Check distance to line
                const A = endY - startY;
                const B = startX - endX;
                const C = endX * startY - startX * endY;
                
                const distToLine = Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
                
                const dotProduct = (x - startX) * (endX - startX) + (y - startY) * (endY - startY);
                const squaredLength = (endX - startX) * (endX - startX) + (endY - startY) * (endY - startY);
                const param = dotProduct / squaredLength;
                
                if (distToLine < tolerance && param >= 0 && param <= 1) {
                    return transition;
                }
            }
        }
        return null;
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
        
        // Calculate perpendicular offset
        const unitX = dx / distance;
        const unitY = dy / distance;
        const perpX = -unitY * offsetDistance * offsetDirection;
        const perpY = unitX * offsetDistance * offsetDirection;
        
        const radius = 30;
        const startX = from.x + unitX * radius + perpX;
        const startY = from.y + unitY * radius + perpY;
        const endX = to.x - unitX * radius + perpX;
        const endY = to.y - unitY * radius + perpY;
        
        // Check distance to offset line
        const A = endY - startY;
        const B = startX - endX;
        const C = endX * startY - startX * endY;
        
        const distToLine = Math.abs(A * x + B * y + C) / Math.sqrt(A * A + B * B);
        
        const dotProduct = (x - startX) * (endX - startX) + (y - startY) * (endY - startY);
        const squaredLength = (endX - startX) * (endX - startX) + (endY - startY) * (endY - startY);
        const param = dotProduct / squaredLength;
        
        return distToLine < tolerance && param >= 0 && param <= 1;
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
            
            // Calculate perpendicular offset
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
        this.pendingTransitionData = { from: transition.from, to: transition.to, editingTransition: transition };
        document.getElementById('transitionInput').value = transition.symbol;
        document.getElementById('transitionModal').style.display = 'block';
        setTimeout(() => document.getElementById('transitionInput').focus(), 100);
    }
    
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
            // If deleting an offset transition, remove offset from its reverse
            const reverse = this.transitions.find(t => 
                t.from.id === this.selectedTransition.to.id && 
                t.to.id === this.selectedTransition.from.id &&
                t.offset
            );
            if (reverse) {
                reverse.offset = 0;
                reverse.offsetDirection = 0;
                reverse.labelOffset = 0.5;
            }
            
            this.transitions = this.transitions.filter(t => t.id !== this.selectedTransition.id);
            this.selectedTransition = null;
        } else if (this.selectedState) {
            this.states = this.states.filter(s => s.id !== this.selectedState.id);
            this.transitions = this.transitions.filter(t => 
                t.from.id !== this.selectedState.id && t.to.id !== this.selectedState.id
            );
            
            if (this.startState && this.startState.id === this.selectedState.id) {
                this.startState = null;
            }
            
            this.selectedState = null;
        }
        
        document.getElementById('deleteModal').style.display = 'none';
        this.draw();
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
    
    testString() {
        const input = document.getElementById('testInput').value.trim();
        const result = this.simulateInput(input);
        const resultDiv = document.getElementById('result');
        
        if (result) {
            resultDiv.textContent = `ACCEPTED: "${input}"`;
            resultDiv.className = 'result accept';
        } else {
            resultDiv.textContent = `REJECTED: "${input}"`;
            resultDiv.className = 'result reject';
        }
    }
    
    simulateInput(input) {
        if (!this.startState) {
            alert('No start state defined!');
            return false;
        }
        
        let currentState = this.startState;
        
        for (let symbol of input) {
            const transition = this.transitions.find(t => {
                if (t.from.id !== currentState.id) return false;
                const symbols = t.symbol.split(',').map(s => s.trim());
                return symbols.includes(symbol);
            });
            
            if (!transition) {
                return false;
            }
            
            currentState = transition.to;
        }
        
        return currentState.isFinal;
    }
    
    // Step-by-step debugging methods
    startStepDebug() {
        const input = document.getElementById('testInput').value.trim();
        if (!this.startState) {
            alert('No start state defined!');
            return;
        }
        
        this.debugMode = true;
        this.debugString = input;
        this.debugSteps = [];
        this.currentDebugStep = -1;
        
        // Generate debug steps
        let currentState = this.startState;
        this.debugSteps.push({
            step: 0,
            state: currentState,
            char: null,
            transition: null,
            remaining: input,
            message: `Starting at state ${currentState.label}`
        });
        
        for (let i = 0; i < input.length; i++) {
            const char = input[i];
            const transition = this.transitions.find(t => {
                if (t.from.id !== currentState.id) return false;
                const symbols = t.symbol.split(',').map(s => s.trim());
                return symbols.includes(char);
            });
            
            if (!transition) {
                this.debugSteps.push({
                    step: i + 1,
                    state: currentState,
                    char: char,
                    transition: null,
                    remaining: input.substring(i),
                    message: `No transition for '${char}' from ${currentState.label}. REJECTED.`,
                    rejected: true
                });
                break;
            }
            
            this.debugSteps.push({
                step: i + 1,
                state: transition.to,
                char: char,
                transition: transition,
                remaining: input.substring(i + 1),
                message: `Read '${char}', transition from ${currentState.label} to ${transition.to.label}`
            });
            
            currentState = transition.to;
        }
        
        // Final step
        if (!this.debugSteps[this.debugSteps.length - 1].rejected) {
            const finalAccepted = currentState.isFinal;
            this.debugSteps.push({
                step: input.length + 1,
                state: currentState,
                char: null,
                transition: null,
                remaining: '',
                message: `String consumed. ${currentState.label} is ${finalAccepted ? '' : 'not '}a final state. ${finalAccepted ? 'ACCEPTED' : 'REJECTED'}.`,
                final: true,
                accepted: finalAccepted
            });
        }
        
        document.getElementById('stepDebugger').style.display = 'block';
        this.currentDebugStep = 0;
        this.updateDebugDisplay();
    }
    
    stepNext() {
        if (this.currentDebugStep < this.debugSteps.length - 1) {
            this.currentDebugStep++;
            this.updateDebugDisplay();
        }
    }
    
    stepPrev() {
        if (this.currentDebugStep > 0) {
            this.currentDebugStep--;
            this.updateDebugDisplay();
        }
    }
    
    resetDebug() {
        this.debugMode = false;
        this.currentDebugStep = -1;
        this.debugSteps = [];
        document.getElementById('stepDebugger').style.display = 'none';
        this.draw();
    }
    
    updateDebugDisplay() {
        const step = this.debugSteps[this.currentDebugStep];
        const debugInfo = document.getElementById('debugInfo');
        
        let html = `<h4>Step ${step.step}</h4>`;
        html += `<p><strong>Current State:</strong> <span class="current-state">${step.state.label}</span></p>`;
        
        if (step.char) {
            html += `<p><strong>Reading Character:</strong> <span class="current-char">${step.char}</span></p>`;
        }
        
        if (step.remaining) {
            html += `<p><strong>Remaining Input:</strong> "${step.remaining}"</p>`;
        }
        
        html += `<p><strong>Action:</strong> ${step.message}</p>`;
        
        if (step.transition) {
            html += `<p><strong>Using Transition:</strong> ${step.transition.from.label} --${step.transition.symbol}--> ${step.transition.to.label}</p>`;
        }
        
        debugInfo.innerHTML = html;
        this.draw();
    }
    
    draw() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        
        // Draw transitions
        this.transitions.forEach(transition => {
            this.drawTransition(transition);
        });
        
        // Draw states
        this.states.forEach(state => {
            this.drawState(state);
        });
        
        // Draw transition source indicator
        if (this.transitionSource) {
            const colors = this.getThemeColors();
            this.ctx.strokeStyle = colors.danger;
            this.ctx.lineWidth = 4;
            this.ctx.setLineDash([8, 4]);
            this.ctx.beginPath();
            this.ctx.arc(this.transitionSource.x, this.transitionSource.y, 35, 0, 2 * Math.PI);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
    }
    
    drawState(state) {
        const radius = 30;
        const colors = this.getThemeColors();
        
        // Highlight current debug state
        let isDebugState = false;
        if (this.debugMode && this.currentDebugStep >= 0) {
            const currentStep = this.debugSteps[this.currentDebugStep];
            isDebugState = currentStep && currentStep.state.id === state.id;
        }
        
        const isHovered = this.hoveredState === state;
        const isSelected = state === this.selectedState;
        const isStartState = state === this.startState;
        
        this.ctx.beginPath();
        this.ctx.arc(state.x, state.y, radius, 0, 2 * Math.PI);
        
        // Fill with appropriate color based on theme
        if (isDebugState) {
            this.ctx.fillStyle = colors.accent; // Debug highlight
        } else if (isSelected) {
            this.ctx.fillStyle = colors.info;
        } else if (isStartState) {
            this.ctx.fillStyle = colors.bgSecondary;
        } else if (isHovered && this.mode === 'move') {
            // Light hover color with theme awareness
            this.ctx.fillStyle = colors.isLightMode ? '#e3f2fd' : '#1a2332';
        } else {
            this.ctx.fillStyle = colors.bgSecondary;
        }
        this.ctx.fill();
        
        // Border with theme colors
        if (isDebugState) {
            this.ctx.strokeStyle = colors.accent2;
            this.ctx.lineWidth = 4;
        } else {
            this.ctx.strokeStyle = colors.textPrimary;
            this.ctx.lineWidth = 2.5;
        }
        this.ctx.stroke();
        
        // Double circle for final states
        if (state.isFinal) {
            this.ctx.strokeStyle = isDebugState ? colors.accent2 : colors.textPrimary;
            this.ctx.lineWidth = isDebugState ? 3 : 2;
            this.ctx.beginPath();
            this.ctx.arc(state.x, state.y, radius - 6, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
        
        // Start state arrow with theme colors
        if (state === this.startState) {
            this.ctx.strokeStyle = colors.textPrimary;
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            
            const startX = state.x - 75;
            const endX = state.x - 36;
            const y = state.y;
            
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            
            this.ctx.moveTo(endX - 12, y - 10);
            this.ctx.lineTo(endX, y);
            this.ctx.lineTo(endX - 12, y + 10);
            this.ctx.stroke();
        }
        
        // Label with theme-aware colors
        if (isSelected || isDebugState) {
            this.ctx.fillStyle = colors.isLightMode ? 'white' : colors.bgPrimary;
        } else {
            this.ctx.fillStyle = colors.textPrimary;
        }
        this.ctx.font = 'bold 16px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(state.label, state.x, state.y);
    }
    
    drawTransition(transition) {
        const from = transition.from;
        const to = transition.to;
        const colors = this.getThemeColors();
        
        // Check if this is the current debug transition
        let isDebugTransition = false;
        if (this.debugMode && this.currentDebugStep >= 0) {
            const currentStep = this.debugSteps[this.currentDebugStep];
            isDebugTransition = currentStep && currentStep.transition && currentStep.transition.id === transition.id;
        }
        
        const isSelected = this.selectedTransition && this.selectedTransition.id === transition.id;
        const isHovered = this.hoveredTransition && this.hoveredTransition.id === transition.id;
        
        if (from.id === to.id) {
            this.drawSelfLoop(from, transition, isSelected, isHovered, isDebugTransition);
            return;
        }
        
        if (transition.offset) {
            this.drawOffsetTransition(transition, isSelected, isHovered, isDebugTransition);
            return;
        }
        
        // Draw straight transition
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) return;
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const radius = 30;
        const startX = from.x + unitX * radius;
        const startY = from.y + unitY * radius;
        const endX = to.x - unitX * radius;
        const endY = to.y - unitY * radius;
        
        // Color based on state with theme colors
        let strokeColor = colors.textPrimary;
        if (isDebugTransition) strokeColor = colors.accent;
        else if (isSelected) strokeColor = colors.danger;
        else if (isHovered) strokeColor = colors.danger;
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = (isSelected || isHovered || isDebugTransition) ? 3.5 : 2.5;
        
        // Draw straight line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrowhead
        const arrowAngle = Math.atan2(dy, dx);
        this.drawArrowhead(endX, endY, arrowAngle, isSelected || isHovered || isDebugTransition);
        
        // Draw label
        if (this.showLabels) {
            const labelPos = this.getTransitionLabelPosition(transition);
            if (labelPos) {
                this.drawTransitionLabel(transition.symbol, labelPos.x, labelPos.y, isSelected || isHovered || isDebugTransition);
            }
        }
    }

    drawOffsetTransition(transition, isSelected, isHovered, isDebugTransition) {
        const from = transition.from;
        const to = transition.to;
        const offsetDistance = transition.offset || 0;
        const offsetDirection = transition.offsetDirection || 0;
        const colors = this.getThemeColors();
        
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10) return;
        
        // Calculate perpendicular offset
        const unitX = dx / distance;
        const unitY = dy / distance;
        const perpX = -unitY * offsetDistance * offsetDirection;
        const perpY = unitX * offsetDistance * offsetDirection;
        
        const radius = 30;
        const startX = from.x + unitX * radius + perpX;
        const startY = from.y + unitY * radius + perpY;
        const endX = to.x - unitX * radius + perpX;
        const endY = to.y - unitY * radius + perpY;
        
        // Color based on state with theme colors
        let strokeColor = colors.textPrimary;
        if (isDebugTransition) strokeColor = colors.accent;
        else if (isSelected) strokeColor = colors.danger;
        else if (isHovered) strokeColor = colors.danger;
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = (isSelected || isHovered || isDebugTransition) ? 3.5 : 2.5;
        
        // Draw offset line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrowhead
        const arrowAngle = Math.atan2(endY - startY, endX - startX);
        this.drawArrowhead(endX, endY, arrowAngle, isSelected || isHovered || isDebugTransition);
        
        // Draw label
        if (this.showLabels) {
            const labelPos = this.getTransitionLabelPosition(transition);
            if (labelPos) {
                this.drawTransitionLabel(transition.symbol, labelPos.x, labelPos.y, isSelected || isHovered || isDebugTransition);
            }
        }
    }
    
    drawArrowhead(x, y, angle, isHighlighted) {
        const arrowLength = 15;
        const arrowHeadAngle = Math.PI / 5;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
            x - arrowLength * Math.cos(angle - arrowHeadAngle),
            y - arrowLength * Math.sin(angle - arrowHeadAngle)
        );
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(
            x - arrowLength * Math.cos(angle + arrowHeadAngle),
            y - arrowLength * Math.sin(angle + arrowHeadAngle)
        );
        this.ctx.stroke();
    }
    
    drawTransitionLabel(text, x, y, isHighlighted) {
        if (!this.showLabels) return;
        
        const colors = this.getThemeColors();
        
        this.ctx.font = '14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const metrics = this.ctx.measureText(text);
        const padding = 6;
        const bgWidth = metrics.width + padding * 2;
        const bgHeight = 20;
        
        // Background and border colors based on theme and highlight state
        if (isHighlighted) {
            this.ctx.fillStyle = colors.isLightMode ? 'rgba(193, 132, 1, 0.9)' : 'rgba(255, 193, 7, 0.9)';
            this.ctx.strokeStyle = colors.accent;
        } else {
            this.ctx.fillStyle = colors.isLightMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(40, 44, 52, 0.95)';
            this.ctx.strokeStyle = colors.textPrimary;
        }
        this.ctx.lineWidth = isHighlighted ? 2 : 1.5;
        
        this.ctx.fillRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight);
        this.ctx.strokeRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight);
        
        // Text color based on theme and highlight state
        if (isHighlighted) {
            this.ctx.fillStyle = colors.isLightMode ? 'white' : '#000';
        } else {
            this.ctx.fillStyle = colors.textPrimary;
        }
        this.ctx.fillText(text, x, y);
    }
    
    drawSelfLoop(state, transition, isSelected, isHovered, isDebugTransition) {
        const radius = 30;
        const loopRadius = 20;
        const loopDistance = 45;
        const colors = this.getThemeColors();
        
        // Use stored angle or default to top
        const angle = transition.selfLoopAngle || -Math.PI/2;
        
        const loopCenterX = state.x + Math.cos(angle) * loopDistance;
        const loopCenterY = state.y + Math.sin(angle) * loopDistance;
        
        // Color based on state with theme colors
        let strokeColor = colors.textPrimary;
        if (isDebugTransition) strokeColor = colors.accent;
        else if (isSelected) strokeColor = colors.danger;
        else if (isHovered) strokeColor = colors.danger;
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = (isSelected || isHovered || isDebugTransition) ? 3.5 : 2.5;
        
        // Draw the main loop circle
        this.ctx.beginPath();
        this.ctx.arc(loopCenterX, loopCenterY, loopRadius, 0, 2 * Math.PI);
        this.ctx.stroke();
        
        // Calculate connection point from state to loop
        const connectionX = state.x + Math.cos(angle) * radius;
        const connectionY = state.y + Math.sin(angle) * radius;
        const loopEdgeX = loopCenterX - Math.cos(angle) * loopRadius;
        const loopEdgeY = loopCenterY - Math.sin(angle) * loopRadius;
        
        // Draw connection line
        this.ctx.beginPath();
        this.ctx.moveTo(connectionX, connectionY);
        this.ctx.lineTo(loopEdgeX, loopEdgeY);
        this.ctx.stroke();
        
        // Calculate arrow position offset to the right
        const arrowOffset = 21.6;
        const perpAngle = angle + Math.PI * 0.8;
        
        const arrowX = loopCenterX + Math.cos(perpAngle) * arrowOffset;
        const arrowY = loopCenterY + Math.sin(perpAngle) * arrowOffset;
        
        // Arrow should point towards the state center
        const arrowAngle = Math.atan2(state.y - arrowY, state.x - arrowX);
        this.drawArrowhead(arrowX, arrowY, arrowAngle, isSelected || isHovered || isDebugTransition);
        
        // Draw label
        if (this.showLabels) {
            const labelDistance = 69;
            const labelX = state.x + Math.cos(angle) * labelDistance;
            const labelY = state.y + Math.sin(angle) * labelDistance;
            this.drawTransitionLabel(transition.symbol, labelX, labelY, isSelected || isHovered || isDebugTransition);
        }
    }
}

// Initialize the simulator
let simulator;

window.addEventListener('load', () => {
    simulator = new DFASimulator();
});

window.addEventListener('resize', () => {
    if (simulator) {
        simulator.setupCanvas();
        simulator.draw();
    }
});

// Control functions
function setMode(mode) {
    simulator.setMode(mode);
}

function setStartState() {
    simulator.setStartState();
}

function toggleFinalState() {
    simulator.toggleFinalState();
}

function deleteSelected() {
    simulator.deleteSelected();
}

function clearAll() {
    simulator.clearAll();
}

function confirmTransition() {
    simulator.confirmTransition();
}

function confirmRename() {
    simulator.confirmRename();
}

function confirmDelete() {
    simulator.confirmDelete();
}

function confirmClearAll() {
    simulator.confirmClearAll();
}

function toggleLabels() {
    simulator.toggleLabels();
}

function testString() {
    simulator.testString();
}

function startStepDebug() {
    simulator.startStepDebug();
}

function stepNext() {
    simulator.stepNext();
}

function stepPrev() {
    simulator.stepPrev();
}

function resetDebug() {
    simulator.resetDebug();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tab + '-test').classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function scrollToInstructions() {
    document.getElementById('instructions').scrollIntoView({
        behavior: 'smooth'
    });
}

// Theme Toggle Functionality
function toggleTheme() {
    const root = document.documentElement;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (root.classList.contains('light-mode')) {
        root.classList.remove('light-mode');
        themeToggle.textContent = '🌓';
        localStorage.setItem('theme', 'dark');
    } else {
        root.classList.add('light-mode');
        themeToggle.textContent = '🌞';
        localStorage.setItem('theme', 'light');
    }
    
    // Redraw canvas with new theme colors
    if (simulator) {
        simulator.draw();
    }
}

function showNotification(message, type = 'info') {
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

// Initialize theme from localStorage
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const root = document.documentElement;
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (savedTheme === 'light') {
        root.classList.add('light-mode');
        themeToggle.textContent = '🌞';
    } else {
        themeToggle.textContent = '🌓';
    }
}

function runBulkTest() {
    if (!simulator.startState) {
        alert('No start state defined!');
        return;
    }
    
    const acceptStrings = document.getElementById('acceptInput').value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s !== null);
    
    const rejectStrings = document.getElementById('rejectInput').value
        .split('\n')
        .map(s => s.trim())
        .filter(s => s !== null);
    
    const results = [];
    let totalTests = 0;
    let passedTests = 0;
    
    acceptStrings.forEach(str => {
        if (str === '' || acceptStrings.indexOf(str) === acceptStrings.lastIndexOf(str)) {
            const testStr = str === '' ? '(empty string)' : str;
            const actualResult = simulator.simulateInput(str);
            const expectedResult = true;
            const passed = actualResult === expectedResult;
            
            results.push({
                string: testStr,
                expected: 'ACCEPT',
                actual: actualResult ? 'ACCEPT' : 'REJECT',
                passed: passed
            });
            
            totalTests++;
            if (passed) passedTests++;
        }
    });
    
    rejectStrings.forEach(str => {
        if (str === '' || rejectStrings.indexOf(str) === rejectStrings.lastIndexOf(str)) {
            const testStr = str === '' ? '(empty string)' : str;
            const actualResult = simulator.simulateInput(str);
            const expectedResult = false;
            const passed = actualResult === expectedResult;
            
            results.push({
                string: testStr,
                expected: 'REJECT',
                actual: actualResult ? 'ACCEPT' : 'REJECT',
                passed: passed
            });
            
            totalTests++;
            if (passed) passedTests++;
        }
    });
    
    displayBulkResults(results, passedTests, totalTests);
}

function displayBulkResults(results, passed, total) {
    const resultsDiv = document.getElementById('bulkResults');
    
    let html = '<div class="bulk-results">';
    html += '<h4>Test Results:</h4>';
    
    results.forEach(result => {
        const statusClass = result.passed ? 'pass' : 'fail';
        const statusIcon = result.passed ? '✅' : '❌';
        html += `
            <div class="test-result-item ${statusClass}">
                <span>"${result.string}" → Expected: ${result.expected}, Got: ${result.actual}</span>
                <span>${statusIcon}</span>
            </div>
        `;
    });
    
    const summaryClass = passed === total ? 'all-pass' : 'has-fail';
    const summaryIcon = passed === total ? '🎉' : '⚠️';
    html += `
        <div class="test-summary ${summaryClass}">
            ${summaryIcon} ${passed}/${total} tests passed
        </div>
    `;
    
    html += '</div>';
    resultsDiv.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    loadDFAFromURL();

    const testInput = document.getElementById('testInput');
    if (testInput) {
        testInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                testString();
            }
        });
    }

    // Close modals when clicking outside
    window.addEventListener('click', (event) => {
        const deleteModal = document.getElementById('deleteModal');
        const clearModal = document.getElementById('clearModal');
        
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
        }
        if (event.target === clearModal) {
            clearModal.style.display = 'none';
        }
    });
});

// Firebase and URL management for DFA Simulator
// Improved version with better error handling, security, and maintainability

class DFADataManager {
    constructor() {
        this.lastShareTime = 0;
        this.SHARE_COOLDOWN = 3000; // 3 seconds between shares
        this.MAX_DFA_SIZE = 25000; // Reduced from 50KB
        this.MAX_RETRIES = 3;
        this.ID_LENGTH = 8; // Increased from 6 for better collision resistance
    }

    // Generate cryptographically secure unique ID
    generateShortId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const array = new Uint8Array(this.ID_LENGTH);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < this.ID_LENGTH; i++) {
            result += chars.charAt(array[i] % chars.length);
        }
        return result;
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
            const shortId = this.generateShortId();
            
            try {
                const docRef = window.firebaseDoc(window.firebaseDb, 'dfas', shortId);
                const docSnap = await window.firebaseGetDoc(docRef);
                
                if (!docSnap.exists()) {
                    return shortId;
                }
            } catch (error) {
                console.warn(`Attempt ${attempt + 1} failed:`, error);
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

    // Validate DFA data structure
    validateDFAData(dfaData) {
        if (!dfaData || typeof dfaData !== 'object') {
            throw new Error('Invalid DFA data structure');
        }

        if (!Array.isArray(dfaData.states)) {
            throw new Error('States must be an array');
        }

        if (!Array.isArray(dfaData.transitions)) {
            throw new Error('Transitions must be an array');
        }

        // Validate data size
        const dataSize = JSON.stringify(dfaData).length;
        if (dataSize > this.MAX_DFA_SIZE) {
            throw new Error(`DFA too large (${dataSize} bytes, max ${this.MAX_DFA_SIZE})`);
        }

        // Validate states
        dfaData.states.forEach((state, index) => {
            if (typeof state.id !== 'number') {
                throw new Error(`State ${index} has invalid ID`);
            }
            if (typeof state.x !== 'number' || typeof state.y !== 'number') {
                throw new Error(`State ${index} has invalid coordinates`);
            }
        });

        // Validate transitions
        dfaData.transitions.forEach((transition, index) => {
            if (typeof transition.fromId !== 'number' || typeof transition.toId !== 'number') {
                throw new Error(`Transition ${index} has invalid state references`);
            }
            if (!transition.symbol || typeof transition.symbol !== 'string') {
                throw new Error(`Transition ${index} has invalid symbol`);
            }
        });

        return true;
    }

    // Sanitize loaded DFA data
    sanitizeDFAData(dfaData) {
        return {
            states: dfaData.states.map(state => ({
                id: parseInt(state.id) || 0,
                x: Math.max(0, Math.min(2000, parseInt(state.x) || 100)), // Clamp coordinates
                y: Math.max(0, Math.min(1000, parseInt(state.y) || 100)),
                isFinal: Boolean(state.isFinal),
                label: this.sanitizeString(state.label || `q${state.id}`, 20)
            })),
            transitions: dfaData.transitions.map(transition => ({
                fromId: parseInt(transition.fromId) || 0,
                toId: parseInt(transition.toId) || 0,
                symbol: this.sanitizeString(transition.symbol || 'a', 10),
                offset: Math.max(-50, Math.min(50, parseFloat(transition.offset) || 0)),
                offsetDirection: Math.max(-1, Math.min(1, parseInt(transition.offsetDirection) || 0)),
                labelOffset: Math.max(0, Math.min(1, parseFloat(transition.labelOffset) || 0.5)),
                selfLoopAngle: parseFloat(transition.selfLoopAngle) || -Math.PI/2
            })),
            startStateId: transition.startStateId !== null ? parseInt(dfaData.startStateId) : null,
            stateCounter: Math.max(0, parseInt(dfaData.stateCounter) || 0)
        };
    }

    // Save DFA to Firebase with improved error handling
    async saveDFAToFirebase(dfaData) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase not available');
        }

        // Validate data before saving
        this.validateDFAData(dfaData);

        try {
            const shortId = await this.generateUniqueShortId();
            const docRef = window.firebaseDoc(window.firebaseDb, 'dfas', shortId);
            
            const documentData = {
                dfaData: dfaData,
                createdAt: new Date().toISOString(),
                version: '1.1',
                userAgent: navigator.userAgent.slice(0, 100) // Truncated for privacy
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
                throw new Error('Failed to save DFA. Please try again.');
            }
        }
    }

    // Load DFA from Firebase with improved error handling
    async loadDFAFromFirebase(shortId) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase not configured');
        }

        // Validate shortId format
        if (!/^[A-Za-z0-9]{6,10}$/.test(shortId)) {
            throw new Error('Invalid link format');
        }

        try {
            const docRef = window.firebaseDoc(window.firebaseDb, 'dfas', shortId);
            const docSnap = await window.firebaseGetDoc(docRef);
            
            if (!docSnap.exists()) {
                throw new Error('DFA not found. Link may be invalid or expired.');
            }

            const data = docSnap.data();
            
            // Validate document structure
            if (!data.dfaData) {
                throw new Error('Invalid document format');
            }

            // Sanitize data before loading
            const sanitizedData = this.sanitizeDFAData(data.dfaData);
            this.loadDFAFromData(sanitizedData);

            return sanitizedData;

        } catch (error) {
            console.error('Error loading from Firebase:', error);
            
            if (error.message.includes('not found') || error.message.includes('expired')) {
                throw error; // Re-throw user-friendly messages
            } else if (error.code === 'permission-denied') {
                throw new Error('Access denied');
            } else {
                throw new Error('Failed to load DFA from server');
            }
        }
    }

    // Unified DFA data loading function
    loadDFAFromData(dfaData) {
        try {
            // Validate data structure
            this.validateDFAData(dfaData);

            // Clear current DFA
            if (typeof simulator !== 'undefined') {
                simulator.states = [];
                simulator.transitions = [];
                simulator.selectedState = null;
                simulator.selectedTransition = null;
                simulator.startState = null;
                simulator.transitionSource = null;
                if (typeof simulator.resetDebug === 'function') {
                    simulator.resetDebug();
                }
            }

            // Restore states
            const stateMap = new Map();
            dfaData.states.forEach(stateData => {
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

            // Restore transitions with better ID generation
            dfaData.transitions.forEach(transitionData => {
                const fromState = stateMap.get(transitionData.fromId);
                const toState = stateMap.get(transitionData.toId);
                
                if (fromState && toState) {
                    const transition = {
                        id: crypto.getRandomValues(new Uint32Array(1))[0], // Better ID generation
                        from: fromState,
                        to: toState,
                        symbol: transitionData.symbol,
                        offset: transitionData.offset,
                        offsetDirection: transitionData.offsetDirection,
                        labelOffset: transitionData.labelOffset,
                        selfLoopAngle: transitionData.selfLoopAngle
                    };
                    simulator.transitions.push(transition);
                } else {
                    console.warn('Skipping transition with invalid state references:', transitionData);
                }
            });

            // Restore start state
            if (dfaData.startStateId !== null && dfaData.startStateId !== undefined) {
                simulator.startState = stateMap.get(dfaData.startStateId);
                if (!simulator.startState) {
                    console.warn('Start state not found, clearing start state reference');
                }
            }

            // Restore counter
            simulator.stateCounter = Math.max(dfaData.stateCounter || 0, simulator.states.length);

            if (typeof simulator.draw === 'function') {
                simulator.draw();
            }

        } catch (error) {
            console.error('Error loading DFA data:', error);
            throw new Error(`Failed to load DFA: ${error.message}`);
        }
    }

    // Enhanced URL encoding with rate limiting
    async encodeDFAToURL() {
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

        const dfaData = {
            states: simulator.states.map(state => ({
                id: state.id,
                x: Math.round(state.x),
                y: Math.round(state.y),
                isFinal: state.isFinal,
                label: state.label
            })),
            transitions: simulator.transitions.map(transition => ({
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
                    const shortId = await this.saveDFAToFirebase(dfaData);
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
            const jsonString = JSON.stringify(dfaData);
            
            // Use base64url encoding (URL-safe)
            const encodedData = btoa(jsonString)
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            
            const currentURL = window.location.href.split('?')[0];
            const shareURL = `${currentURL}?dfa=${encodedData}`;
            
            // Check URL length
            if (shareURL.length > 2000) {
                throw new Error('DFA too complex for direct URL sharing');
            }
            
            await this.copyToClipboard(shareURL);
            return { success: true, url: shareURL, type: 'direct' };

        } catch (error) {
            console.error('Error creating shareable link:', error);
            throw new Error(`Failed to create shareable link: ${error.message}`);
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

    // Enhanced URL loading with better error handling
    loadDFAFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedDFA = urlParams.get('dfa');
        const shortId = urlParams.get('id');
        
        // Handle Firebase short URLs
        if (shortId) {
            this.loadDFAFromFirebase(shortId)
                .then(() => {
                    showNotification('DFA loaded successfully!', 'success');
                })
                .catch(error => {
                    console.error('Failed to load DFA:', error);
                    showNotification(error.message, 'error');
                })
                .finally(() => {
                    // Clean URL
                    window.history.replaceState({}, document.title, window.location.pathname);
                });
            return;
        }

        // Handle direct encoded URLs
        if (!encodedDFA) return;

        try {
            // Handle both regular base64 and base64url encoding
            let jsonString;
            try {
                jsonString = atob(encodedDFA.replace(/-/g, '+').replace(/_/g, '/'));
            } catch {
                // Try without replacement for backward compatibility
                jsonString = atob(encodedDFA);
            }

            const dfaData = JSON.parse(jsonString);
            const sanitizedData = this.sanitizeDFAData(dfaData);
            
            this.loadDFAFromData(sanitizedData);
            showNotification('DFA loaded successfully!', 'success');

        } catch (error) {
            console.error('Error loading DFA from URL:', error);
            showNotification('Invalid or corrupted DFA link', 'error');
        } finally {
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
}

// Initialize the data manager
const dfaDataManager = new DFADataManager();

// Global functions for backward compatibility
async function encodeDFAToURL() {
    try {
        showNotification('Creating shareable link...', 'info');
        const result = await dfaDataManager.encodeDFAToURL();
        
        const message = result.type === 'firebase' 
            ? 'Short link copied to clipboard!' 
            : 'Link copied to clipboard!';
        showNotification(message, 'success');
        
    } catch (error) {
        console.error('Share failed:', error);
        showNotification(error.message, 'error');
    }
}

function loadDFAFromURL() {
    dfaDataManager.loadDFAFromURL();
}

// Utility function for notifications (assuming it exists in your main script)
function showNotification(message, type = 'info') {
    // This should match your existing notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
}