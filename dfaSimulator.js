// dfaSimulator.js - DFA-specific implementation

class DFASimulator extends BaseAutomaton {
    constructor(canvasId = 'canvas') {
        super(canvasId);
    }

    getAutomatonType() {
        return 'dfa';
    }

    // DFA-specific validation: no duplicate symbols from same state
    validateTransition(fromState, toState, symbols) {
        // Check if symbols are single characters
        for (let symbol of symbols) {
            if (symbol.length !== 1) {
                throw new Error('Each symbol must be exactly one character!');
            }
        }

        // DFA rule: no duplicate symbol from the same state
        for (let symbol of symbols) {
            const duplicate = this.transitions.find(t => 
                t.from.id === fromState.id && 
                t.symbol.split(',').map(s => s.trim()).includes(symbol)
            );
            if (duplicate) {
                throw new Error(`DFA rule violation: State '${fromState.label}' already has a transition for symbol '${symbol}'!`);
            }
        }
        
        return true;
    }

    // DFA simulation
    simulateInput(input) {
        if (!this.startState) {
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

    // Test string functionality
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

    // Step-by-step debugging
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

    // Drawing implementation
    draw() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
        
        // Draw transitions first (so they appear behind states)
        this.transitions.forEach(transition => {
            this.drawTransition(transition);
        });
        
        // Draw states
        this.states.forEach(state => {
            this.drawState(state);
        });
        
        // Draw transition source indicator
        if (this.transitionSource) {
            const colors = ThemeManager.getThemeColors();
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
        const colors = ThemeManager.getThemeColors();
        
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
        const colors = ThemeManager.getThemeColors();
        
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
        const colors = ThemeManager.getThemeColors();
        
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
        
        const colors = ThemeManager.getThemeColors();
        
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
        const colors = ThemeManager.getThemeColors();
        
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

    // Bulk testing functionality
    runBulkTest() {
        if (!this.startState) {
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
                const actualResult = this.simulateInput(str);
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
                const actualResult = this.simulateInput(str);
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
        
        this.displayBulkResults(results, passedTests, totalTests);
    }

    displayBulkResults(results, passed, total) {
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
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DFASimulator;
}