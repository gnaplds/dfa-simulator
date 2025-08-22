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
        
        this.setupCanvas();
        this.setupEventListeners();
        this.draw();
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
        
        // Prevent scrolling on canvas
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
    
    handleHover(x, y) {
        const hoveredTransition = this.getTransitionAt(x, y);
        if (hoveredTransition !== this.hoveredTransition) {
            this.hoveredTransition = hoveredTransition;
            this.draw();
        }
    }
    
    handleDown(x, y) {
        const clickedState = this.getStateAt(x, y);
        const clickedTransition = this.getTransitionAt(x, y);
        const clickedLabel = this.getLabelAt(x, y);
        const clickedSelfLoop = this.getSelfLoopAt(x, y);
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
        let symbol = prompt('Enter transition symbol (single character):', '');
        if (symbol !== null) {
            symbol = symbol.trim();
            if (symbol.length !== 1) {
                alert('Transition symbol must be exactly one character!');
                return;
            }
            
            // Check if transition already exists
            const existing = this.transitions.find(t => 
                t.from.id === from.id && t.to.id === to.id && t.symbol === symbol
            );
            
            if (!existing) {
                const transition = {
                    id: Date.now() + Math.random(),
                    from: from,
                    to: to,
                    symbol: symbol
                };

                // Add label position properties for self-loops
                if (from.id === to.id) {
                    transition.selfLoopAngle = -Math.PI/2; // Default to top
                } else {
                    transition.labelOffset = 0.5; // Default to middle of transition
                }

                this.transitions.push(transition);
            } else {
                alert('This transition already exists!');
            }
        }
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

        const tolerance = 15;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                // Self-loop label
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                const loopDistance = 55;
                const labelDistance = 80;
                
                const labelX = state.x + Math.cos(angle) * labelDistance;
                const labelY = state.y + Math.sin(angle) * labelDistance;
                
                const dx = x - labelX;
                const dy = y - labelY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < tolerance) {
                    return { transition: transition, type: 'selfLoop' };
                }
            } else {
                // Regular transition label
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
                
                // Calculate label position based on transition type and offset
                let labelX, labelY;
                
                // Check if this is a curved or straight transition
                const allTransitions = this.transitions.filter(t => 
                    (t.from.id === from.id && t.to.id === to.id) ||
                    (t.from.id === to.id && t.to.id === from.id)
                );
                const sameDirectionTransitions = this.transitions.filter(t => 
                    t.from.id === from.id && t.to.id === to.id
                );
                const hasBidirectional = allTransitions.length > sameDirectionTransitions.length;
                
                if (hasBidirectional || sameDirectionTransitions.length > 1) {
                    // Curved transition
                    const transitionIndex = sameDirectionTransitions.indexOf(transition);
                    const curveOffset = (transitionIndex + 1) * 30;
                    const perpX = -unitY;
                    const perpY = unitX;
                    
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;
                    const controlX = midX + perpX * curveOffset;
                    const controlY = midY + perpY * curveOffset;
                    
                    const t = transition.labelOffset || 0.5;
                    labelX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                    labelY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
                } else {
                    // Straight line transition
                    const t = transition.labelOffset || 0.5;
                    labelX = startX + (endX - startX) * t;
                    labelY = startY + (endY - startY) * t;
                }
                
                const labelDx = x - labelX;
                const labelDy = y - labelY;
                const labelDistance = Math.sqrt(labelDx * labelDx + labelDy * labelDy);
                
                if (labelDistance < tolerance) {
                    return { transition: transition, type: 'regular' };
                }
            }
        }
        return null;
    }

    getSelfLoopAt(x, y) {
        const tolerance = 15;
        
        for (let transition of this.transitions) {
            if (transition.from.id === transition.to.id) {
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                const loopRadius = 25;
                const loopDistance = 55;
                
                const loopCenterX = state.x + Math.cos(angle) * loopDistance;
                const loopCenterY = state.y + Math.sin(angle) * loopDistance;
                
                const dx = x - loopCenterX;
                const dy = y - loopCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (Math.abs(distance - loopRadius) < tolerance) {
                    return transition;
                }
            }
        }
        return null;
    }

    moveLabelAlongTransition(labelInfo, x, y) {
        const transition = labelInfo.transition;
        
        if (labelInfo.type === 'regular' && transition.from.id !== transition.to.id) {
            const from = transition.from;
            const to = transition.to;
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
            
            // Check if this is a curved transition
            const allTransitions = this.transitions.filter(t => 
                (t.from.id === from.id && t.to.id === to.id) ||
                (t.from.id === to.id && t.to.id === from.id)
            );
            const sameDirectionTransitions = this.transitions.filter(t => 
                t.from.id === from.id && t.to.id === to.id
            );
            const hasBidirectional = allTransitions.length > sameDirectionTransitions.length;
            
            if (hasBidirectional || sameDirectionTransitions.length > 1) {
                // Curved transition - project onto curve
                const transitionIndex = sameDirectionTransitions.indexOf(transition);
                const curveOffset = (transitionIndex + 1) * 30;
                const perpX = -unitY;
                const perpY = unitX;
                
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const controlX = midX + perpX * curveOffset;
                const controlY = midY + perpY * curveOffset;
                
                // Find closest point on curve
                let closestT = 0.5;
                let minDistance = Infinity;
                
                for (let t = 0; t <= 1; t += 0.01) {
                    const curveX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                    const curveY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
                    const dist = Math.sqrt((x - curveX)*(x - curveX) + (y - curveY)*(y - curveY));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestT = t;
                    }
                }
                
                transition.labelOffset = closestT;
            } else {
                // Straight transition - project onto line
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
                // Self-loop - improved detection
                const state = transition.from;
                const angle = transition.selfLoopAngle || -Math.PI/2;
                
                const loopRadius = 25;
                const loopDistance = 55;
                const loopCenterX = state.x + Math.cos(angle) * loopDistance;
                const loopCenterY = state.y + Math.sin(angle) * loopDistance;
                
                const dx = x - loopCenterX;
                const dy = y - loopCenterY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (Math.abs(distance - loopRadius) < tolerance) {
                    return transition;
                }
            } else {
                // Regular transition - make straight lines for multiple transitions
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
                
                // Get all transitions between these two states
                const sameDirectionTransitions = this.transitions.filter(t => 
                    t.from.id === from.id && t.to.id === to.id
                );
                
                if (sameDirectionTransitions.length <= 1) {
                    // Single transition - straight line
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
                } else {
                    // Multiple transitions or bidirectional - curved
                    const allTransitions = this.transitions.filter(t => 
                        (t.from.id === from.id && t.to.id === to.id) ||
                        (t.from.id === to.id && t.to.id === from.id)
                    );
                    const forwardTransitions = allTransitions.filter(t => t.from.id === from.id && t.to.id === to.id);
                    const transitionIndex = forwardTransitions.indexOf(transition);
                    
                    if (transitionIndex !== -1) {
                        const unitX = dx / distance;
                        const unitY = dy / distance;
                        const radius = 30;
                        const startX = from.x + unitX * radius;
                        const startY = from.y + unitY * radius;
                        const endX = to.x - unitX * radius;
                        const endY = to.y - unitY * radius;
                        
                        const curveOffset = (transitionIndex + 1) * 30;
                        const perpX = -unitY;
                        const perpY = unitX;
                        
                        const midX = (startX + endX) / 2;
                        const midY = (startY + endY) / 2;
                        const controlX = midX + perpX * curveOffset;
                        const controlY = midY + perpY * curveOffset;
                        
                        // Sample points along the curve
                        for (let t = 0; t <= 1; t += 0.05) {
                            const curveX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
                            const curveY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
                            const distToCurve = Math.sqrt((x - curveX)*(x - curveX) + (y - curveY)*(y - curveY));
                            if (distToCurve < tolerance) {
                                return transition;
                            }
                        }
                    }
                }
            }
        }
        return null;
    }
    
    renameState(state) {
        const newName = prompt('Enter new state name:', state.label);
        if (newName !== null && newName.trim() !== '') {
            state.label = newName.trim();
            this.draw();
        }
    }
    
    editTransitionSymbol(transition) {
        let newSymbol = prompt('Enter new transition symbol (single character):', transition.symbol);
        if (newSymbol !== null) {
            newSymbol = newSymbol.trim();
            if (newSymbol.length !== 1) {
                alert('Transition symbol must be exactly one character!');
                return;
            }
            
            // Check if this would create a duplicate
            const existing = this.transitions.find(t => 
                t.from.id === transition.from.id && 
                t.to.id === transition.to.id && 
                t.symbol === newSymbol &&
                t.id !== transition.id
            );
            
            if (!existing) {
                transition.symbol = newSymbol;
                this.draw();
            } else {
                alert('A transition with this symbol already exists between these states!');
            }
        }
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
            const transition = this.transitions.find(t => 
                t.from.id === currentState.id && t.symbol === symbol
            );
            
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
            const transition = this.transitions.find(t => 
                t.from.id === currentState.id && t.symbol === char
            );
            
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
            this.ctx.strokeStyle = '#ff6b6b';
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
        
        // Highlight current debug state
        let isDebugState = false;
        if (this.debugMode && this.currentDebugStep >= 0) {
            const currentStep = this.debugSteps[this.currentDebugStep];
            isDebugState = currentStep && currentStep.state.id === state.id;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(state.x, state.y, radius, 0, 2 * Math.PI);
        
        // Fill with appropriate color
        if (isDebugState) {
            this.ctx.fillStyle = '#ffc107'; // Debug highlight
        } else if (state === this.selectedState) {
            this.ctx.fillStyle = '#007bff';
        } else if (state === this.startState) {
            this.ctx.fillStyle = '#28a745';
        } else {
            this.ctx.fillStyle = '#f8f9fa';
        }
        this.ctx.fill();
        
        // Border
        this.ctx.strokeStyle = isDebugState ? '#ff6600' : '#2c3e50';
        this.ctx.lineWidth = isDebugState ? 4 : 2.5;
        this.ctx.stroke();
        
        // Double circle for final states
        if (state.isFinal) {
            this.ctx.strokeStyle = isDebugState ? '#ff6600' : '#2c3e50';
            this.ctx.lineWidth = isDebugState ? 3 : 2;
            this.ctx.beginPath();
            this.ctx.arc(state.x, state.y, radius - 6, 0, 2 * Math.PI);
            this.ctx.stroke();
        }
        
        // Start state arrow
        if (state === this.startState) {
            this.ctx.strokeStyle = '#28a745';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            
            const startX = state.x - 50;
            const endX = state.x - 35;
            const y = state.y;
            
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            
            this.ctx.moveTo(endX - 8, y - 5);
            this.ctx.lineTo(endX, y);
            this.ctx.lineTo(endX - 8, y + 5);
            this.ctx.stroke();
        }
        
        // Label
        this.ctx.fillStyle = (state === this.selectedState || isDebugState) ? 'white' : '#2c3e50';
        this.ctx.font = 'bold 16px Kalam, Comic Sans MS, cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(state.label, state.x, state.y);
    }
    
    drawTransition(transition) {
        const from = transition.from;
        const to = transition.to;
        
        // Check if this is the current debug transition
        let isDebugTransition = false;
        if (this.debugMode && this.currentDebugStep >= 0) {
            const currentStep = this.debugSteps[this.currentDebugStep];
            isDebugTransition = currentStep && currentStep.transition && currentStep.transition.id === transition.id;
        }
        
        const isSelected = this.selectedTransition && this.selectedTransition.id === transition.id;
        const isHovered = this.hoveredTransition && this.hoveredTransition.id === transition.id;
        
        // Calculate arrow position
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 10 || from.id === to.id) {
            this.drawSelfLoop(from, transition, isSelected, isHovered, isDebugTransition);
            return;
        }
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const radius = 30;
        const startX = from.x + unitX * radius;
        const startY = from.y + unitY * radius;
        const endX = to.x - unitX * radius;
        const endY = to.y - unitY * radius;
        
        // Get all transitions between these two states (both directions)
        const allTransitions = this.transitions.filter(t => 
            (t.from.id === from.id && t.to.id === to.id) ||
            (t.from.id === to.id && t.to.id === from.id)
        );
        
        const sameDirectionTransitions = this.transitions.filter(t => 
            t.from.id === from.id && t.to.id === to.id
        );
        
        // Color based on state
        let strokeColor = '#2c3e50';
        if (isDebugTransition) strokeColor = '#ffc107';
        else if (isSelected) strokeColor = '#ff6b6b';
        else if (isHovered) strokeColor = '#ff6b6b';
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = (isSelected || isHovered || isDebugTransition) ? 3.5 : 2.5;
        
        // Check if there are bidirectional transitions
        const hasBidirectional = allTransitions.length > sameDirectionTransitions.length;
        
        if (sameDirectionTransitions.length > 1 && !hasBidirectional) {
            // Multiple transitions in same direction only - use parallel lines
            this.drawParallelTransition(startX, startY, endX, endY, unitX, unitY, transition, from, to, isSelected || isHovered || isDebugTransition);
        } else if (hasBidirectional || sameDirectionTransitions.length > 1) {
            // Bidirectional or multiple transitions - use curves
            this.drawCurvedTransition(startX, startY, endX, endY, unitX, unitY, distance, transition, from, to, isSelected || isHovered || isDebugTransition);
        } else {
            // Single transition - straight line
            this.drawStraightTransition(startX, startY, endX, endY, dx, dy, transition, isSelected || isHovered || isDebugTransition);
        }
    }
    
    drawCurvedTransition(startX, startY, endX, endY, unitX, unitY, distance, transition, from, to, isHighlighted) {
        // Get all transitions between these two states for proper curve offset
        const allTransitions = this.transitions.filter(t => 
            (t.from.id === from.id && t.to.id === to.id) ||
            (t.from.id === to.id && t.to.id === from.id)
        );
        const forwardTransitions = this.transitions.filter(t => t.from.id === from.id && t.to.id === to.id);
        const transitionIndex = forwardTransitions.indexOf(transition);
        
        if (transitionIndex === -1) return;
        
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        
        const perpX = -unitY;
        const perpY = unitX;
        const curveOffset = (transitionIndex + 1) * 30;
        
        const controlX = midX + perpX * curveOffset;
        const controlY = midY + perpY * curveOffset;
        
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        this.ctx.stroke();
        
        // Calculate arrowhead direction
        const t = 0.9;
        const beforeEndX = (1-t)*(1-t)*startX + 2*(1-t)*t*controlX + t*t*endX;
        const beforeEndY = (1-t)*(1-t)*startY + 2*(1-t)*t*controlY + t*t*endY;
        
        const arrowDx = endX - beforeEndX;
        const arrowDy = endY - beforeEndY;
        const arrowAngle = Math.atan2(arrowDy, arrowDx);
        
        this.drawArrowhead(endX, endY, arrowAngle, isHighlighted);
        
        // Draw label on the curve
        if (this.showLabels) {
            const labelT = transition.labelOffset || 0.5;
            const labelX = (1-labelT)*(1-labelT)*startX + 2*(1-labelT)*labelT*controlX + labelT*labelT*endX;
            const labelY = (1-labelT)*(1-labelT)*startY + 2*(1-labelT)*labelT*controlY + labelT*labelT*endY;
            
            this.drawTransitionLabel(transition.symbol, labelX, labelY, isHighlighted);
        }
    }
    
    drawParallelTransition(startX, startY, endX, endY, unitX, unitY, transition, from, to, isHighlighted) {
        // Get transitions in the same direction for proper parallel offset
        const sameDirectionTransitions = this.transitions.filter(t => t.from.id === from.id && t.to.id === to.id);
        const transitionIndex = sameDirectionTransitions.indexOf(transition);
        
        if (transitionIndex === -1) return;
        
        // Calculate perpendicular offset for parallel lines
        const perpX = -unitY;
        const perpY = unitX;
        const offset = (transitionIndex - (sameDirectionTransitions.length - 1) / 2) * 20;
        
        const offsetStartX = startX + perpX * offset;
        const offsetStartY = startY + perpY * offset;
        const offsetEndX = endX + perpX * offset;
        const offsetEndY = endY + perpY * offset;
        
        this.ctx.beginPath();
        this.ctx.moveTo(offsetStartX, offsetStartY);
        this.ctx.lineTo(offsetEndX, offsetEndY);
        this.ctx.stroke();
        
        const arrowAngle = Math.atan2(offsetEndY - offsetStartY, offsetEndX - offsetStartX);
        this.drawArrowhead(offsetEndX, offsetEndY, arrowAngle, isHighlighted);
        
        // Draw label at specified offset along the line
        if (this.showLabels) {
            const t = transition.labelOffset || 0.5;
            const labelX = offsetStartX + (offsetEndX - offsetStartX) * t;
            const labelY = offsetStartY + (offsetEndY - offsetStartY) * t;
            this.drawTransitionLabel(transition.symbol, labelX, labelY, isHighlighted);
        }
    }
    
    drawStraightTransition(startX, startY, endX, endY, dx, dy, transition, isHighlighted) {
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        const arrowAngle = Math.atan2(dy, dx);
        this.drawArrowhead(endX, endY, arrowAngle, isHighlighted);
        
        if (this.showLabels) {
            const t = transition.labelOffset || 0.5;
            const labelX = startX + (endX - startX) * t;
            const labelY = startY + (endY - startY) * t;
            this.drawTransitionLabel(transition.symbol, labelX, labelY, isHighlighted);
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
        
        this.ctx.font = '14px Kalam, Comic Sans MS, cursive';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        const metrics = this.ctx.measureText(text);
        const padding = 6;
        const bgWidth = metrics.width + padding * 2;
        const bgHeight = 20;
        
        this.ctx.fillStyle = isHighlighted ? 'rgba(255, 193, 7, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        this.ctx.strokeStyle = isHighlighted ? '#ffc107' : '#2c3e50';
        this.ctx.lineWidth = isHighlighted ? 2 : 1.5;
        
        this.ctx.fillRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight);
        this.ctx.strokeRect(x - bgWidth/2, y - bgHeight/2, bgWidth, bgHeight);
        
        this.ctx.fillStyle = isHighlighted ? '#000' : '#2c3e50';
        this.ctx.fillText(text, x, y);
    }
    
    drawSelfLoop(state, transition, isSelected, isHovered, isDebugTransition) {
        const radius = 30;
        const loopRadius = 25;
        const loopDistance = 55;
        
        // Use stored angle or default to top
        const angle = transition.selfLoopAngle || -Math.PI/2;
        
        const loopCenterX = state.x + Math.cos(angle) * loopDistance;
        const loopCenterY = state.y + Math.sin(angle) * loopDistance;
        
        // Color based on state
        let strokeColor = '#2c3e50';
        if (isDebugTransition) strokeColor = '#ffc107';
        else if (isSelected) strokeColor = '#ff6b6b';
        else if (isHovered) strokeColor = '#ff6b6b';
        
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = (isSelected || isHovered || isDebugTransition) ? 3.5 : 2.5;
        
        // Draw the loop circle
        this.ctx.beginPath();
        this.ctx.arc(loopCenterX, loopCenterY, loopRadius, 0.3 * Math.PI + angle, 2.7 * Math.PI + angle);
        this.ctx.stroke();
        
        // Connection lines
        const entryAngle = angle - 0.4;
        const exitAngle = angle + 0.4;
        
        const stateEntryX = state.x + Math.cos(entryAngle) * radius;
        const stateEntryY = state.y + Math.sin(entryAngle) * radius;
        const loopEntryX = loopCenterX + Math.cos(entryAngle) * loopRadius;
        const loopEntryY = loopCenterY + Math.sin(entryAngle) * loopRadius;
        
        this.ctx.beginPath();
        this.ctx.moveTo(stateEntryX, stateEntryY);
        this.ctx.lineTo(loopEntryX, loopEntryY);
        this.ctx.stroke();
        
        const stateExitX = state.x + Math.cos(exitAngle) * radius;
        const stateExitY = state.y + Math.sin(exitAngle) * radius;
        const loopExitX = loopCenterX + Math.cos(exitAngle) * loopRadius;
        const loopExitY = loopCenterY + Math.sin(exitAngle) * loopRadius;
        
        this.ctx.beginPath();
        this.ctx.moveTo(loopExitX, loopExitY);
        this.ctx.lineTo(stateExitX, stateExitY);
        this.ctx.stroke();
        
        // Arrowhead
        const arrowAngle = exitAngle + Math.PI;
        this.drawArrowhead(stateExitX, stateExitY, arrowAngle, isSelected || isHovered || isDebugTransition);
        
        // Label
        if (this.showLabels) {
            const labelX = loopCenterX + Math.cos(angle) * (loopRadius + 20);
            const labelY = loopCenterY + Math.sin(angle) * (loopRadius + 20);
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