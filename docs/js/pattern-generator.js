/**
 * Pattern Generator - Converts images to knitting/cross-stitch patterns using k-means clustering
 */
export class PatternGenerator {
    constructor() {
        this.originalImage = null;
        this.currentPatternData = null;
        this.isEditMode = false;
        this.selectedEditColor = null;
        
        // Multi-select state
        this.isDragging = false;
        this.dragStartPos = null;
        this.selectedCells = new Set();
        this.selectionRect = null;
        
        // Auto-save state
        this.hasUnsavedChanges = false;
        this.autoSaveTimer = null;
        
        // Row/column manipulation state
        this.contextMenuRow = 0;
        this.contextMenuColumn = 0;
        
        this.setupEventListeners();
        this.setupKeyboardEventListeners();
    }

    setupKeyboardEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.isEditMode) return;
            
            // Escape key to clear selection
            if (event.key === 'Escape') {
                this.clearSelection();
                event.preventDefault();
            }
            
            // Delete key to delete selected cells (make them transparent or background color)
            if (event.key === 'Delete' || event.key === 'Backspace') {
                if (this.selectedCells.size > 0 && this.currentPatternData?.palette?.[0]) {
                    // Use the first color in palette as background/delete color
                    const backgroundColor = this.currentPatternData.palette[0];
                    this.selectedCells.forEach(index => {
                        this.updateSingleStitch(index, backgroundColor);
                    });
                    this.clearSelection();
                    event.preventDefault();
                }
            }
        });
    }

    clearSelection() {
        this.selectedCells.clear();
        this.selectionRect = null;
        this.isDragging = false;
        this.redrawCanvasWithSelection();
    }

    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const imageInput = document.getElementById('imageInput');
        const generateBtn = document.getElementById('generatePattern');

        if (!uploadArea || !imageInput || !generateBtn) return;

        // File upload handling
        uploadArea.addEventListener('click', () => imageInput.click());
        uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadArea.addEventListener('drop', this.handleDrop.bind(this));
        imageInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Control updates
        const widthSlider = document.getElementById('stitchWidth');
        const heightSlider = document.getElementById('stitchHeight');
        const colorInput = document.getElementById('colorCount');
        const craftType = document.getElementById('craftType');

        // Color count input doesn't need real-time updates since we removed auto-regeneration
        // The value will be read when Generate Pattern is clicked

        // Setup measurement inputs (always active now)
        this.setupMeasurementInputs();

        // Craft type handling
        if (craftType) {
            craftType.addEventListener('change', this.handleCraftTypeChange.bind(this));
            this.handleCraftTypeChange(); // Initialize on load
        }

        // Fabric count changes should keep measurements constant
        const fabricCount = document.getElementById('fabricCount');
        if (fabricCount) {
            fabricCount.addEventListener('input', () => {
                // Keep measurements constant, recalculate stitch count based on new fabric count
                this.updateStitchesFromMeasurements();
                // Update strand count based on new gauge
                this.updateStrandCountForCrossStitch();
            });
        }

        // Strand count changes for material calculations
        const strandCount = document.getElementById('strandCount');
        if (strandCount) {
            strandCount.addEventListener('input', () => {
                // No automatic regeneration, just update for next generation
            });
        }
        
        // Gauge changes should keep measurements constant
        const yarnGauge = document.getElementById('yarnGauge');
        if (yarnGauge) {
            yarnGauge.addEventListener('input', () => {
                // Keep measurements constant, recalculate stitch count based on new gauge
                this.updateStitchesFromMeasurements();
            });
        }

        // Yarn weight changes should sync with gauge
        const yarnWeight = document.getElementById('yarnWeight');
        if (yarnWeight && yarnGauge) {
            yarnWeight.addEventListener('change', (e) => {
                const selectedOption = e.target.selectedOptions[0];
                const gauge = selectedOption.getAttribute('data-gauge');
                if (gauge) {
                    yarnGauge.value = gauge;
                    // Keep measurements constant, recalculate stitch count based on new gauge
                    this.updateStitchesFromMeasurements();
                }
            });
        }

        generateBtn.addEventListener('click', this.generatePattern.bind(this));

        // Edit mode toggle
        this.setupEditModeToggle();

        // Export button listeners
        this.setupExportListeners();
    }

    handleCraftTypeChange() {
        const craftType = document.getElementById('craftType').value;
        const yarnControls = document.getElementById('yarnControls');
        const threadControls = document.getElementById('threadControls');
        const fabricControls = document.getElementById('fabricControls');
        const gaugeControls = document.getElementById('gaugeControls');
        
        // Show/hide controls based on craft type
        if (['knitting', 'crochet'].includes(craftType)) {
            // Yarn-based crafts
            yarnControls.style.display = 'flex';
            threadControls.style.display = 'none';
            fabricControls.style.display = 'none';
            gaugeControls.style.display = 'flex';
        } else {
            // Fabric-based crafts (cross-stitch, embroidery, tapestry)
            yarnControls.style.display = 'none';
            threadControls.style.display = 'flex';
            fabricControls.style.display = 'flex';
            gaugeControls.style.display = 'none';
        }
        
        // Update pattern title
        const patternTitle = document.querySelector('.pattern-image h4');
        if (patternTitle) {
            const craftNames = {
                'knitting': 'Knitting',
                'cross-stitch': 'Cross-Stitch',
                'embroidery': 'Embroidery',
                'crochet': 'Crochet',
                'tapestry': 'Tapestry/Needlepoint'
            };
            patternTitle.textContent = `Generated ${craftNames[craftType]} Pattern`;
        }
        
        // Update measurements when craft type changes (affects gauge/fabric count)
        this.updateMeasurementsFromStitches();
        
        // Update strand count for cross-stitch based on gauge
        this.updateStrandCountForCrossStitch();
    }

    updateStrandCountForCrossStitch() {
        const craftType = document.getElementById('craftType')?.value;
        const strandCountElement = document.getElementById('strandCount');
        const fabricCountElement = document.getElementById('fabricCount');
        
        // Apply this logic to all thread/floss-based crafts (cross-stitch, embroidery, tapestry)
        if (['cross-stitch', 'embroidery', 'tapestry'].includes(craftType) && strandCountElement && fabricCountElement) {
            const gauge = parseInt(fabricCountElement.value);
            
            // If gauge is 14 stitches/inch or less, use 3 strands; otherwise use 2 strands
            const defaultStrands = gauge <= 14 ? 3 : 2;
            strandCountElement.value = defaultStrands;
        }
    }

    setupMeasurementInputs() {
        const finishedWidth = document.getElementById('finishedWidth');
        const finishedHeight = document.getElementById('finishedHeight');
        
        // Width input
        if (finishedWidth) {
            finishedWidth.addEventListener('input', (e) => {
                this.updateStitchesFromMeasurements();
                if (this.originalImage) {
                    this.updateHeightFromWidth();
                }
            });
        }
        
        // Height input
        if (finishedHeight) {
            finishedHeight.addEventListener('input', (e) => {
                this.updateStitchesFromMeasurements();
            });
        }
        
        // Initialize measurements based on current stitch counts
        this.updateMeasurementsFromStitches();
    }

    updateStitchesFromMeasurements() {
        const finishedWidth = parseFloat(document.getElementById('finishedWidth').value);
        const finishedHeight = parseFloat(document.getElementById('finishedHeight').value);
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        if (!isNaN(finishedWidth) && !isNaN(finishedHeight) && stitchesPerInch) {
            // Input is in inches, gauge is in stitches per inch
            const stitchWidth = Math.round(finishedWidth * stitchesPerInch);
            const stitchHeight = Math.round(finishedHeight * stitchesPerInch);
            
            // Update hidden stitch inputs (clamped to min/max values)
            document.getElementById('stitchWidth').value = Math.max(10, Math.min(200, stitchWidth));
            document.getElementById('stitchHeight').value = Math.max(10, Math.min(200, stitchHeight));
        }
    }

    updateMeasurementsFromStitches() {
        const stitchWidth = parseInt(document.getElementById('stitchWidth').value);
        const stitchHeight = parseInt(document.getElementById('stitchHeight').value);
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        if (stitchWidth && stitchHeight && stitchesPerInch) {
            // Gauge is in stitches per inch, calculate inches directly
            const widthInches = (stitchWidth / stitchesPerInch).toFixed(1);
            const heightInches = (stitchHeight / stitchesPerInch).toFixed(1);
            
            // Update display with inch values
            document.getElementById('finishedWidth').value = widthInches;
            document.getElementById('finishedHeight').value = heightInches;
        }
    }

    setupEditModeToggle() {
        const editModeToggle = document.getElementById('editModeToggle');
        const editInstructions = document.getElementById('editModeInstructions');
        const editColorPalette = document.getElementById('editColorPalette');
        const addColorSection = document.getElementById('addColorSection');
        const rowColumnControls = document.getElementById('rowColumnControls');

        console.log('Setting up edit mode toggle. Button found:', !!editModeToggle);

        if (editModeToggle) {
            editModeToggle.addEventListener('click', () => {
                console.log('Edit mode toggle clicked. Current state:', this.isEditMode);
                this.isEditMode = !this.isEditMode;
                console.log('New edit mode state:', this.isEditMode);
                
                if (this.isEditMode) {
                    editModeToggle.textContent = 'Exit Edit Mode';
                    editModeToggle.classList.add('active');
                    if (editInstructions) editInstructions.style.display = 'block';
                    if (editColorPalette) editColorPalette.style.display = 'flex';
                    if (addColorSection) addColorSection.style.display = 'flex';
                    if (rowColumnControls) rowColumnControls.style.display = 'block';
                    this.setupEditColorPalette();
                    this.setupAddColorButton();
                    
                    // Enable scrolling for edit mode
                    const canvasContainer = document.querySelector('.pattern-canvas-container');
                    if (canvasContainer) canvasContainer.classList.add('edit-mode');
                    
                    // Refresh color palette to show edit tooltips
                    if (this.currentPatternData) {
                        this.displayColorPalette(this.currentPatternData.palette);
                    }
                } else {
                    editModeToggle.textContent = 'Enable Edit Mode';
                    editModeToggle.classList.remove('active');
                    if (editInstructions) editInstructions.style.display = 'none';
                    if (editColorPalette) editColorPalette.style.display = 'none';
                    if (addColorSection) addColorSection.style.display = 'none';
                    if (rowColumnControls) rowColumnControls.style.display = 'none';
                    this.selectedEditColor = null;
                    
                    // Disable scrolling for viewing mode
                    const canvasContainer = document.querySelector('.pattern-canvas-container');
                    if (canvasContainer) canvasContainer.classList.remove('edit-mode');
                    
                    // Refresh color palette to hide edit tooltips
                    if (this.currentPatternData) {
                        this.displayColorPalette(this.currentPatternData.palette);
                    }
                    
                    // Update material estimates when exiting edit mode
                    console.log('Exiting edit mode - updating material estimates');
                    this.calculateAndDisplayMaterials(
                        this.currentPatternData, 
                        this.currentPatternData.width, 
                        this.currentPatternData.height
                    );
                }
                
                // Update canvas styling
                this.updateCanvasStyle();
                
                // Redraw pattern with new cell size
                if (this.currentPatternData) {
                    this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
                }
            });
        }
    }

    setupEditColorPalette() {
        if (!this.currentPatternData || !this.currentPatternData.palette) return;

        const editColorPalette = document.getElementById('editColorPalette');
        if (!editColorPalette) return;

        editColorPalette.innerHTML = '';

        this.currentPatternData.palette.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'edit-color-swatch';
            swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            swatch.textContent = index + 1;

            // Check if this is the currently selected color
            if (this.selectedEditColor && 
                color[0] === this.selectedEditColor[0] && 
                color[1] === this.selectedEditColor[1] && 
                color[2] === this.selectedEditColor[2]) {
                swatch.classList.add('selected');
            }

            swatch.addEventListener('click', () => {
                // Remove selection from all swatches
                editColorPalette.querySelectorAll('.edit-color-swatch').forEach(s => 
                    s.classList.remove('selected'));
                
                // Select this swatch
                swatch.classList.add('selected');
                this.selectedEditColor = [...color];
                console.log('Selected edit color:', this.selectedEditColor);
                
                // If we have selected cells, apply the color immediately
                if (this.selectedCells.size > 0) {
                    this.updateSelectedCells();
                }
            });

            // Add double-click to edit the color throughout the pattern
            swatch.addEventListener('dblclick', () => {
                this.openColorEditor(index, color);
            });

            editColorPalette.appendChild(swatch);
        });

        // Auto-select the first color if none is selected
        if (!this.selectedEditColor && this.currentPatternData.palette.length > 0) {
            const firstSwatch = editColorPalette.querySelector('.edit-color-swatch');
            if (firstSwatch) {
                firstSwatch.classList.add('selected');
                this.selectedEditColor = [...this.currentPatternData.palette[0]];
            }
        }
        
        // Setup row/column controls
        this.setupRowColumnControls();
    }

    setupRowColumnControls() {
        const rowColumnControls = document.getElementById('rowColumnControls');
        if (!rowColumnControls) return;

        // Show the controls
        rowColumnControls.style.display = 'block';

        // Setup button event listeners
        const insertRowBtn = document.getElementById('insertRowBtn');
        const deleteRowBtn = document.getElementById('deleteRowBtn');
        const insertColumnBtn = document.getElementById('insertColumnBtn');
        const deleteColumnBtn = document.getElementById('deleteColumnBtn');

        if (insertRowBtn) {
            insertRowBtn.onclick = () => this.insertRow();
        }
        if (deleteRowBtn) {
            deleteRowBtn.onclick = () => this.deleteRow();
        }
        if (insertColumnBtn) {
            insertColumnBtn.onclick = () => this.insertColumn();
        }
        if (deleteColumnBtn) {
            deleteColumnBtn.onclick = () => this.deleteColumn();
        }
    }

    insertRow() {
        if (!this.currentPatternData) return;
        
        const position = Math.floor(this.contextMenuRow) || Math.floor(this.currentPatternData.height / 2);
        const { width, height, pixels } = this.currentPatternData;
        
        // Create new row with default color (first palette color)
        const defaultColor = this.currentPatternData.palette[0];
        const newRow = new Array(width).fill(null).map(() => [...defaultColor]);
        
        // Create new pixels array with inserted row
        const newPixels = [];
        const insertIndex = position * width;
        
        // Add pixels before insertion point
        for (let i = 0; i < insertIndex; i++) {
            newPixels.push([...pixels[i]]);
        }
        
        // Add new row
        newRow.forEach(color => newPixels.push(color));
        
        // Add pixels after insertion point
        for (let i = insertIndex; i < pixels.length; i++) {
            newPixels.push([...pixels[i]]);
        }
        
        // Update pattern data
        this.currentPatternData.pixels = newPixels;
        this.currentPatternData.height = height + 1;
        
        // Redraw pattern
        this.displayPattern(this.currentPatternData, width, height + 1);
        this.hasUnsavedChanges = true;
        
        this.showToast(`Row inserted at position ${position + 1}`, 'success');
    }

    deleteRow() {
        if (!this.currentPatternData || this.currentPatternData.height <= 1) {
            alert('Cannot delete the last row!');
            return;
        }
        
        const position = Math.floor(this.contextMenuRow) || Math.floor(this.currentPatternData.height / 2);
        const { width, height, pixels } = this.currentPatternData;
        
        // Create new pixels array without the specified row
        const newPixels = [];
        const deleteStartIndex = position * width;
        const deleteEndIndex = deleteStartIndex + width;
        
        // Add pixels before deletion point
        for (let i = 0; i < deleteStartIndex; i++) {
            newPixels.push([...pixels[i]]);
        }
        
        // Skip the row to delete
        
        // Add pixels after deletion point
        for (let i = deleteEndIndex; i < pixels.length; i++) {
            newPixels.push([...pixels[i]]);
        }
        
        // Update pattern data
        this.currentPatternData.pixels = newPixels;
        this.currentPatternData.height = height - 1;
        
        // Redraw pattern
        this.displayPattern(this.currentPatternData, width, height - 1);
        this.hasUnsavedChanges = true;
        
        this.showToast(`Row ${position + 1} deleted`, 'success');
    }

    insertColumn() {
        if (!this.currentPatternData) return;
        
        const position = Math.floor(this.contextMenuColumn) || Math.floor(this.currentPatternData.width / 2);
        const { width, height, pixels } = this.currentPatternData;
        
        // Default color for new column
        const defaultColor = this.currentPatternData.palette[0];
        
        // Create new pixels array with inserted column
        const newPixels = [];
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col <= width; col++) {
                if (col === position) {
                    // Insert new pixel at this position
                    newPixels.push([...defaultColor]);
                } else if (col < position) {
                    // Copy pixel from original position
                    newPixels.push([...pixels[row * width + col]]);
                } else {
                    // Copy pixel from position shifted by 1
                    newPixels.push([...pixels[row * width + (col - 1)]]);
                }
            }
        }
        
        // Update pattern data
        this.currentPatternData.pixels = newPixels;
        this.currentPatternData.width = width + 1;
        
        // Redraw pattern
        this.displayPattern(this.currentPatternData, width + 1, height);
        this.hasUnsavedChanges = true;
        
        this.showToast(`Column inserted at position ${position + 1}`, 'success');
    }

    deleteColumn() {
        if (!this.currentPatternData || this.currentPatternData.width <= 1) {
            alert('Cannot delete the last column!');
            return;
        }
        
        const position = Math.floor(this.contextMenuColumn) || Math.floor(this.currentPatternData.width / 2);
        const { width, height, pixels } = this.currentPatternData;
        
        // Create new pixels array without the specified column
        const newPixels = [];
        
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                if (col !== position) {
                    // Copy pixel (skip the column to delete)
                    newPixels.push([...pixels[row * width + col]]);
                }
            }
        }
        
        // Update pattern data
        this.currentPatternData.pixels = newPixels;
        this.currentPatternData.width = width - 1;
        
        // Redraw pattern
        this.displayPattern(this.currentPatternData, width - 1, height);
        this.hasUnsavedChanges = true;
        
        this.showToast(`Column ${position + 1} deleted`, 'success');
    }

    setupAddColorButton() {
        const addColorBtn = document.getElementById('addColorBtn');
        const newColorPicker = document.getElementById('newColorPicker');

        if (addColorBtn && newColorPicker) {
            // Remove any existing listeners to avoid duplicates
            const newAddColorBtn = addColorBtn.cloneNode(true);
            addColorBtn.parentNode.replaceChild(newAddColorBtn, addColorBtn);

            newAddColorBtn.addEventListener('click', () => {
                const hexColor = newColorPicker.value;
                const rgbColor = this.hexToRgb(hexColor);
                
                console.log('Adding new color:', hexColor, rgbColor);
                
                // Check if color already exists in palette
                const colorExists = this.currentPatternData.palette.some(color => 
                    color[0] === rgbColor[0] && color[1] === rgbColor[1] && color[2] === rgbColor[2]);
                
                if (colorExists) {
                    alert('This color is already in the palette!');
                    return;
                }
                
                // Add new color to palette
                this.currentPatternData.palette.push(rgbColor);
                
                // Refresh the edit color palette
                this.setupEditColorPalette();
                
                // Also update the main color palette display
                this.displayColorPalette(this.currentPatternData.palette);
                
                // Auto-select the new color
                this.selectedEditColor = [...rgbColor];
                
                console.log('New color added successfully');
            });
        }
    }

    openColorEditor(colorIndex, currentColor) {
        if (!this.currentPatternData) return;
        
        // Create color editor modal
        const modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        modal.innerHTML = `
            <div class="color-picker-content">
                <h4>Edit Color ${colorIndex + 1} Throughout Pattern</h4>
                <p>This will change all stitches currently using this color</p>
                <div class="color-picker-section">
                    <label for="colorEditor">Choose new color:</label>
                    <input type="color" id="colorEditor" value="${this.rgbToHex(currentColor)}">
                </div>
                <div class="color-preview">
                    <div class="current-color">
                        <span>Current:</span>
                        <div class="color-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                    <div class="new-color">
                        <span>New:</span>
                        <div class="color-sample" id="newColorSample" style="background-color: ${this.rgbToHex(currentColor)}"></div>
                    </div>
                </div>
                <div class="color-picker-buttons">
                    <button id="applyColorEdit" class="apply-btn">Apply to All</button>
                    <button id="cancelColorEdit" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const colorEditor = modal.querySelector('#colorEditor');
        const newColorSample = modal.querySelector('#newColorSample');
        const applyBtn = modal.querySelector('#applyColorEdit');
        const cancelBtn = modal.querySelector('#cancelColorEdit');
        
        // Update preview as user changes color
        colorEditor.addEventListener('input', (e) => {
            newColorSample.style.backgroundColor = e.target.value;
        });
        
        // Apply color change to all instances
        applyBtn.addEventListener('click', () => {
            const newColor = this.hexToRgb(colorEditor.value);
            this.updateAllInstancesOfColor(colorIndex, currentColor, newColor);
            document.body.removeChild(modal);
        });
        
        // Cancel color change
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateAllInstancesOfColor(colorIndex, oldColor, newColor) {
        if (!this.currentPatternData) return;
        
        console.log('Updating all instances of color', colorIndex, 'from', oldColor, 'to', newColor);
        
        // Update the palette
        this.currentPatternData.palette[colorIndex] = [...newColor];
        
        // Update all pixels that use this color
        this.currentPatternData.pixels = this.currentPatternData.pixels.map(pixel => {
            if (pixel[0] === oldColor[0] && pixel[1] === oldColor[1] && pixel[2] === oldColor[2]) {
                return [...newColor];
            }
            return pixel;
        });
        
        // Update the selected edit color if it was the one being changed
        if (this.selectedEditColor && 
            this.selectedEditColor[0] === oldColor[0] && 
            this.selectedEditColor[1] === oldColor[1] && 
            this.selectedEditColor[2] === oldColor[2]) {
            this.selectedEditColor = [...newColor];
        }
        
        // Redraw pattern and palettes
        this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
        this.displayColorPalette(this.currentPatternData.palette);
        this.setupEditColorPalette();
        
        console.log('Color update completed');
    }

    setupExportListeners() {
        const exportImageBtn = document.getElementById('exportImage');
        const exportPaletteBtn = document.getElementById('exportPalette');

        if (exportImageBtn) {
            exportImageBtn.addEventListener('click', this.exportPatternImage.bind(this));
        }
        if (exportPaletteBtn) {
            exportPaletteBtn.addEventListener('click', this.exportColorGuide.bind(this));
        }

        // Setup project name input listener to update button text
        const projectNameInput = document.getElementById('projectName');
        if (projectNameInput) {
            projectNameInput.addEventListener('input', this.updateDownloadButtonText.bind(this));
            // Set initial button text
            this.updateDownloadButtonText();
        }

        // Setup draft management buttons
        this.setupDraftManagement();
    }

    setupDraftManagement() {
        console.log('Setting up draft management...');
        const saveDraftBtn = document.getElementById('saveDraft');
        const loadDraftBtn = document.getElementById('loadDraft');
        const manageDraftsBtn = document.getElementById('manageDrafts');

        console.log('Save draft button found:', !!saveDraftBtn);
        console.log('Load draft button found:', !!loadDraftBtn);

        if (saveDraftBtn) {
            console.log('Adding save draft event listener');
            saveDraftBtn.addEventListener('click', this.saveDraft.bind(this));
        }
        if (loadDraftBtn) {
            loadDraftBtn.addEventListener('click', this.showLoadDraftModal.bind(this));
        }
        if (manageDraftsBtn) {
            manageDraftsBtn.addEventListener('click', this.showDraftManager.bind(this));
        }
    }

    saveDraft() {
        console.log('Save draft function called');
        
        if (!this.currentPatternData) {
            console.log('No current pattern data found');
            alert('No pattern to save! Please generate a pattern first.');
            return;
        }

        console.log('Saving draft with pattern data:', this.currentPatternData);
        
        const projectName = this.getProjectName();
        const draftData = {
            id: Date.now().toString(),
            projectName: projectName,
            timestamp: new Date().toISOString(),
            patternData: this.currentPatternData,
            originalImage: this.originalImage ? this.originalImage.src : null,
            settings: {
                craftType: document.getElementById('craftType')?.value,
                fabricCount: document.getElementById('fabricCount')?.value,
                colorCount: document.getElementById('colorCount')?.value,
                finishedWidth: document.getElementById('finishedWidth')?.value,
                finishedHeight: document.getElementById('finishedHeight')?.value
            }
        };

        console.log('Draft data to save:', draftData);

        // Save to localStorage - always keep only one draft
        const drafts = [];
        drafts.push(draftData);

        try {
            localStorage.setItem('patternDrafts', JSON.stringify(drafts));
            
            // Show success message
            this.showToast(`Draft "${projectName}" saved successfully!`, 'success');
            
            // Auto-save enabled
            this.enableAutoSave();
        } catch (error) {
            console.error('Error saving draft:', error);
            
            // If localStorage is full, try saving without the original image
            if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
                const draftDataWithoutImage = { ...draftData, originalImage: null };
                const draftsWithoutImage = [draftDataWithoutImage];
                
                try {
                    localStorage.setItem('patternDrafts', JSON.stringify(draftsWithoutImage));
                    this.showToast(`Draft "${projectName}" saved successfully (without image)!`, 'success');
                    this.enableAutoSave();
                } catch (secondError) {
                    console.error('Error saving draft even without image:', secondError);
                    this.showToast('Failed to save draft. Storage may be full.', 'error');
                }
            } else {
                this.showToast('Failed to save draft. Please try again.', 'error');
            }
        }
    }

    getSavedDrafts() {
        try {
            const saved = localStorage.getItem('patternDrafts');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading drafts:', error);
            return [];
        }
    }

    showLoadDraftModal() {
        const drafts = this.getSavedDrafts();
        if (drafts.length === 0) {
            alert('No saved draft found.');
            return;
        }

        // Since we only have one draft, just load it directly
        const draft = drafts[0];
        this.loadDraft(draft.id);
    }

    loadDraft(draftId) {
        const drafts = this.getSavedDrafts();
        const draft = drafts.find(d => d.id === draftId);
        
        if (!draft) {
            alert('Draft not found.');
            return;
        }

        console.log('Loading draft:', draft);
        console.log('Draft pattern data:', draft.patternData);

        // Function to complete the loading process
        const completeLoading = () => {
            console.log('Completing loading process...');
            
            // Restore pattern data
            this.currentPatternData = draft.patternData;
            console.log('Set currentPatternData:', this.currentPatternData);
            
            // Restore project name
            const projectNameInput = document.getElementById('projectName');
            if (projectNameInput) {
                projectNameInput.value = draft.projectName;
            }

            // Restore settings
            if (draft.settings) {
                Object.entries(draft.settings).forEach(([key, value]) => {
                    const element = document.getElementById(key);
                    if (element && value) {
                        element.value = value;
                    }
                });
            }

            // Display the pattern with the saved data
            console.log('About to display pattern...');
            this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
            this.displayColorPalette(this.currentPatternData.palette);
            this.updateDownloadButtonText();

            // Show edit mode controls
            const editModeToggle = document.getElementById('editModeToggle');
            if (editModeToggle) {
                editModeToggle.style.display = 'inline-block';
            }

            // Calculate and display materials
            this.calculateAndDisplayMaterials(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);

            // Show the results section so both original image and pattern are visible
            const resultsSection = document.getElementById('resultsSection');
            if (resultsSection) {
                resultsSection.style.display = 'block';
            }

            this.showToast(`Draft "${draft.projectName}" loaded successfully!`, 'success');
            
            // Enable auto-save for loaded draft
            this.enableAutoSave();
        };

        // Restore original image if it exists
        if (draft.originalImage) {
            console.log('Loading original image:', draft.originalImage);
            const img = new Image();
            img.onload = () => {
                console.log('Image loaded successfully');
                this.originalImage = img;
                this.showImagePreview(draft.originalImage);
                this.showControls();
                completeLoading();
            };
            img.onerror = () => {
                console.error('Failed to load image');
                this.showControls();
                completeLoading();
            };
            img.src = draft.originalImage;
        } else {
            console.log('No original image, completing loading directly');
            // If no original image, just show the controls and complete loading
            this.showControls();
            completeLoading();
        }
    }

    deleteDraft(draftId) {
        if (!confirm('Are you sure you want to delete the saved draft?')) {
            return;
        }

        try {
            // Clear all drafts since we only keep one
            localStorage.setItem('patternDrafts', JSON.stringify([]));
            
            this.showToast('Draft deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting draft:', error);
            this.showToast('Failed to delete draft. Please try again.', 'error');
        }
    }

    enableAutoSave() {
        // Clear existing auto-save timer
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        // Auto-save every 30 seconds when pattern is modified
        this.autoSaveTimer = setInterval(() => {
            if (this.currentPatternData && this.hasUnsavedChanges) {
                this.autoSaveDraft();
                this.hasUnsavedChanges = false;
            }
        }, 30000);
    }

    autoSaveDraft() {
        if (!this.currentPatternData) return;

        const projectName = this.getProjectName();
        const drafts = this.getSavedDrafts();
        
        // Always update the single draft if it exists, or create a new one
        if (drafts.length > 0) {
            drafts[0].patternData = this.currentPatternData;
            drafts[0].timestamp = new Date().toISOString();
            drafts[0].projectName = projectName; // Update project name too
            
            try {
                localStorage.setItem('patternDrafts', JSON.stringify(drafts));
                console.log(`Auto-saved draft "${projectName}"`);
            } catch (error) {
                console.error('Error auto-saving draft:', error);
                // Don't show toast for auto-save errors to avoid spam
            }
        }
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to document
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.showImagePreview(e.target.result);
                this.showControls();
                this.calculateHeightFromAspectRatio(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showImagePreview(imageSrc) {
        const previewSection = document.getElementById('imagePreview');
        const previewImage = document.getElementById('previewImage');
        
        if (previewSection && previewImage) {
            previewImage.src = imageSrc;
            previewSection.style.display = 'block';
        }
    }

    showControls() {
        const controlsSection = document.getElementById('controlsSection');
        if (controlsSection) {
            controlsSection.style.display = 'block';
        }
    }

    calculateHeightFromAspectRatio(img) {
        const defaultWidthInches = 5.0; // Default width at 5 inches
        const aspectRatio = img.height / img.width;
        const calculatedHeightInches = defaultWidthInches * aspectRatio;
        
        // Set the measurement input values
        document.getElementById('finishedWidth').value = defaultWidthInches.toFixed(1);
        document.getElementById('finishedHeight').value = calculatedHeightInches.toFixed(1);
        
        // Update hidden stitch inputs to match measurements
        this.updateStitchesFromMeasurements();
    }

    updateHeightFromWidth() {
        if (!this.originalImage) return;
        
        const widthInches = parseFloat(document.getElementById('finishedWidth').value);
        const aspectRatio = this.originalImage.height / this.originalImage.width;
        
        if (!isNaN(widthInches)) {
            const calculatedHeightInches = (widthInches * aspectRatio);
            
            // Update height measurements
            document.getElementById('finishedHeight').value = calculatedHeightInches.toFixed(1);
            
            // Update hidden stitch inputs
            this.updateStitchesFromMeasurements();
        }
    }

    generatePattern() {
        if (!this.originalImage) return;

        const stitchWidth = parseInt(document.getElementById('stitchWidth').value);
        const stitchHeight = parseInt(document.getElementById('stitchHeight').value);
        const colorCount = parseInt(document.getElementById('colorCount').value);
        const enableSmoothing = document.getElementById('patternSmoothing').checked;

        // Create pattern
        const patternData = this.createPattern(stitchWidth, stitchHeight, colorCount, enableSmoothing);
        
        // Ensure width and height are set on the pattern data
        patternData.width = stitchWidth;
        patternData.height = stitchHeight;
        
        this.currentPatternData = patternData; // Store for export
        console.log('Generated pattern data:', patternData); // Debug log
        
        this.displayPattern(patternData, stitchWidth, stitchHeight);
        this.displayColorPalette(patternData.palette);
        
        // Update download button text with project name
        this.updateDownloadButtonText();
        
        // Show edit mode controls
        const editModeToggle = document.getElementById('editModeToggle');
        if (editModeToggle) {
            editModeToggle.style.display = 'inline-block';
        }
        
        // Calculate and display material estimates (always enabled)
        this.calculateAndDisplayMaterials(patternData, stitchWidth, stitchHeight);
        
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
    }

    calculateAndDisplayMaterials(patternData, width, height) {
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
        }
        
        // Calculate finished dimensions
        const finishedWidth = width / stitchesPerInch;
        const finishedHeight = height / stitchesPerInch;
        
        // Count stitches per color
        const colorCounts = new Map();
        patternData.pixels.forEach(pixel => {
            const colorKey = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        });
        
        // Calculate material requirements
        const materials = [];
        patternData.palette.forEach((color, index) => {
            const colorKey = `${color[0]},${color[1]},${color[2]}`;
            const stitchCount = colorCounts.get(colorKey) || 0;
            const yardage = this.calculateYardage(stitchCount, craftType, stitchesPerInch);
            
            materials.push({
                color: color,
                colorNumber: index + 1,
                stitchCount: stitchCount,
                yardage: yardage
            });
        });
        
        this.displayMaterialEstimates(materials, finishedWidth, finishedHeight, width * height);
    }

    calculateYardage(stitchCount, craftType, stitchesPerInch) {
        // Base calculations for different craft types
        let yardsPerStitch;
        
        switch (craftType) {
            case 'cross-stitch':
                // Cross-stitch uses about 1 inch of floss per stitch, multiply by strand count
                const crossStitchStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (crossStitchStrands / stitchesPerInch) / 36; // Convert to yards
                break;
            case 'embroidery':
                // Embroidery varies, but similar to cross-stitch
                const embroideryStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (embroideryStrands * 1.2 / stitchesPerInch) / 36;
                break;
            case 'knitting':
                // Knitting yardage depends on stitch size and yarn weight
                const yarnWeight = document.getElementById('yarnWeight').value;
                const weightMultipliers = {
                    'lace': 0.5, 'fingering': 0.7, 'sport': 1.0, 
                    'dk': 1.3, 'worsted': 1.8, 'bulky': 2.5, 'super-bulky': 3.5
                };
                // For knitting, gauge directly affects yarn usage
                yardsPerStitch = (weightMultipliers[yarnWeight] || 1.3) / (stitchesPerInch * 10);
                break;
            case 'crochet':
                // Crochet uses more yarn than knitting
                const crochetYarnWeight = document.getElementById('yarnWeight').value;
                const crochetMultipliers = {
                    'lace': 0.7, 'fingering': 1.0, 'sport': 1.4, 
                    'dk': 1.8, 'worsted': 2.5, 'bulky': 3.5, 'super-bulky': 5.0
                };
                yardsPerStitch = (crochetMultipliers[crochetYarnWeight] || 1.8) / (stitchesPerInch * 8);
                break;
            case 'tapestry':
                // Tapestry/needlepoint
                const tapestryStrands = parseInt(document.getElementById('strandCount')?.value || 2);
                yardsPerStitch = (tapestryStrands * 1.5 / stitchesPerInch) / 36;
                break;
            default:
                yardsPerStitch = (1 / stitchesPerInch) / 36;
        }
        
        const totalYards = stitchCount * yardsPerStitch;
        
        // Add 10% waste factor
        return Math.ceil(totalYards * 1.1 * 100) / 100; // Round to 2 decimal places
    }

    displayMaterialEstimates(materials, finishedWidth, finishedHeight, totalStitches) {
        const materialEstimates = document.getElementById('materialEstimates');
        const finishedSizeSpan = document.getElementById('finishedSize');
        const totalStitchesSpan = document.getElementById('totalStitches');
        const materialList = document.getElementById('materialList');
        
        if (!materialEstimates || !finishedSizeSpan || !totalStitchesSpan || !materialList) return;
        
        // Update project info
        finishedSizeSpan.textContent = `${finishedWidth.toFixed(1)}" × ${finishedHeight.toFixed(1)}"`;
        totalStitchesSpan.textContent = totalStitches.toLocaleString();
        
        // Clear and populate material list
        materialList.innerHTML = '';
        
        materials.forEach(material => {
            if (material.stitchCount > 0) {
                const materialItem = document.createElement('div');
                materialItem.className = 'material-item';
                materialItem.style.borderLeftColor = `rgb(${material.color.join(', ')})`;
                
                materialItem.innerHTML = `
                    <div class="material-color">
                        <div class="material-swatch" style="background-color: rgb(${material.color.join(', ')})"></div>
                        <div class="material-details">
                            <div class="material-name">Color ${material.colorNumber}</div>
                            <div class="material-rgb">RGB(${material.color.join(', ')})</div>
                        </div>
                    </div>
                    <div class="material-amount">
                        <div class="material-yardage">${material.yardage} yards</div>
                        <div class="material-stitches">${material.stitchCount.toLocaleString()} stitches</div>
                    </div>
                `;
                
                materialList.appendChild(materialItem);
            }
        });
        
        // Show the material estimates section
        materialEstimates.style.display = 'block';
    }

    createPattern(width, height, colorCount, enableSmoothing = true) {
        // Create a temporary canvas to resize the image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // Draw resized image
        tempCtx.drawImage(this.originalImage, 0, 0, width, height);
        
        // Get pixel data
        const imageData = tempCtx.getImageData(0, 0, width, height);
        const pixels = [];
        
        for (let i = 0; i < imageData.data.length; i += 4) {
            pixels.push([
                imageData.data[i],     // R
                imageData.data[i + 1], // G
                imageData.data[i + 2]  // B
            ]);
        }
        
        // Simple k-means clustering for color reduction
        const palette = this.kMeansClustering(pixels, colorCount);
        let quantizedPixels = this.quantizePixels(pixels, palette);
        
        // Apply smoothing if enabled
        if (enableSmoothing) {
            quantizedPixels = this.smoothPattern(quantizedPixels, width, height, palette);
        }
        
        return {
            pixels: quantizedPixels,
            palette: palette,
            width: width,
            height: height
        };
    }

    smoothPattern(pixels, width, height, palette) {
        // Create a 2D array for easier neighbor checking
        const grid = [];
        for (let y = 0; y < height; y++) {
            grid[y] = [];
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                grid[y][x] = pixels[index];
            }
        }
        
        // Apply smoothing algorithm
        const smoothedGrid = JSON.parse(JSON.stringify(grid)); // Deep copy
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const currentColor = grid[y][x];
                const neighbors = [
                    grid[y-1][x-1], grid[y-1][x], grid[y-1][x+1],
                    grid[y][x-1],                 grid[y][x+1],
                    grid[y+1][x-1], grid[y+1][x], grid[y+1][x+1]
                ];
                
                // Check if current pixel is isolated (different from all neighbors)
                const isIsolated = neighbors.every(neighbor => 
                    !this.colorsEqual(currentColor, neighbor)
                );
                
                if (isIsolated) {
                    // Find the most common neighbor color
                    const colorCounts = new Map();
                    neighbors.forEach(neighbor => {
                        const colorKey = `${neighbor[0]},${neighbor[1]},${neighbor[2]}`;
                        colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
                    });
                    
                    let mostCommonColor = currentColor;
                    let maxCount = 0;
                    
                    for (const [colorKey, count] of colorCounts) {
                        if (count > maxCount) {
                            maxCount = count;
                            const [r, g, b] = colorKey.split(',').map(Number);
                            mostCommonColor = [r, g, b];
                        }
                    }
                    
                    smoothedGrid[y][x] = mostCommonColor;
                }
            }
        }
        
        // Convert back to flat array
        const smoothedPixels = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                smoothedPixels.push(smoothedGrid[y][x]);
            }
        }
        
        return smoothedPixels;
    }
    
    colorsEqual(color1, color2) {
        return color1[0] === color2[0] && 
               color1[1] === color2[1] && 
               color1[2] === color2[2];
    }

    kMeansClustering(pixels, k) {
        // Initialize centroids randomly
        let centroids = [];
        for (let i = 0; i < k; i++) {
            const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
            centroids.push([...randomPixel]);
        }
        
        // Iterate to find optimal centroids
        for (let iter = 0; iter < 20; iter++) {
            const clusters = Array.from({ length: k }, () => []);
            
            // Assign pixels to nearest centroid
            pixels.forEach(pixel => {
                let minDist = Infinity;
                let closestCentroid = 0;
                
                centroids.forEach((centroid, idx) => {
                    const dist = this.colorDistance(pixel, centroid);
                    if (dist < minDist) {
                        minDist = dist;
                        closestCentroid = idx;
                    }
                });
                
                clusters[closestCentroid].push(pixel);
            });
            
            // Update centroids
            centroids = clusters.map(cluster => {
                if (cluster.length === 0) return centroids[0];
                
                const avgR = cluster.reduce((sum, p) => sum + p[0], 0) / cluster.length;
                const avgG = cluster.reduce((sum, p) => sum + p[1], 0) / cluster.length;
                const avgB = cluster.reduce((sum, p) => sum + p[2], 0) / cluster.length;
                
                return [Math.round(avgR), Math.round(avgG), Math.round(avgB)];
            });
        }
        
        return centroids;
    }

    colorDistance(color1, color2) {
        const dr = color1[0] - color2[0];
        const dg = color1[1] - color2[1];
        const db = color1[2] - color2[2];
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    quantizePixels(pixels, palette) {
        return pixels.map(pixel => {
            let minDist = Infinity;
            let closestColor = palette[0];
            
            palette.forEach(color => {
                const dist = this.colorDistance(pixel, color);
                if (dist < minDist) {
                    minDist = dist;
                    closestColor = color;
                }
            });
            
            return closestColor;
        });
    }

    displayPattern(patternData, width, height) {
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) {
            console.error('Canvas not found!');
            return;
        }
        
        console.log('Displaying pattern with data:', { 
            pixels: patternData.pixels.length, 
            width, 
            height, 
            hasCanvas: !!canvas 
        });
        
        const ctx = canvas.getContext('2d');
        
        // Use dynamic cell size: 10px for viewing, 15px for editing
        const cellSize = this.isEditMode ? 15 : 10;
        canvas.width = width * cellSize;
        canvas.height = height * cellSize;
        
        // Store cellSize for click detection
        this.cellSize = cellSize;
        console.log('Cell size set to:', this.cellSize, 'Edit mode:', this.isEditMode);
        
        // Remove any existing event listeners to avoid duplicates
        if (this.boundCanvasMouseDown) {
            canvas.removeEventListener('mousedown', this.boundCanvasMouseDown);
        }
        if (this.boundCanvasMouseMove) {
            canvas.removeEventListener('mousemove', this.boundCanvasMouseMove);
        }
        if (this.boundCanvasMouseUp) {
            canvas.removeEventListener('mouseup', this.boundCanvasMouseUp);
        }
        if (this.boundCanvasClick) {
            canvas.removeEventListener('click', this.boundCanvasClick);
        }
        
        // Create and bind the mouse event handlers
        this.boundCanvasMouseDown = this.handleCanvasMouseDown.bind(this);
        this.boundCanvasMouseMove = this.handleCanvasMouseMove.bind(this);
        this.boundCanvasMouseUp = this.handleCanvasMouseUp.bind(this);
        this.boundCanvasClick = this.handleCanvasClick.bind(this);
        this.boundCanvasContextMenu = this.handleCanvasContextMenu.bind(this);
        
        canvas.addEventListener('mousedown', this.boundCanvasMouseDown);
        canvas.addEventListener('mousemove', this.boundCanvasMouseMove);
        canvas.addEventListener('mouseup', this.boundCanvasMouseUp);
        canvas.addEventListener('click', this.boundCanvasClick);
        canvas.addEventListener('contextmenu', this.boundCanvasContextMenu);
        
        console.log('Mouse event listeners bound to canvas');
        
        // Set cursor style based on edit mode
        this.updateCanvasStyle(canvas);
        
        console.log('Pattern display setup completed'); // Debug log
        
        // Draw pattern cells first
        patternData.pixels.forEach((color, index) => {
            const x = (index % width) * cellSize;
            const y = Math.floor(index / width) * cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, cellSize, cellSize);
        });
        
        // Draw clean grid lines over the pattern
        this.drawGrid(ctx, width, height, cellSize);
        
        console.log('Pattern drawing completed');
    }

    updateCanvasStyle(canvas) {
        if (!canvas) canvas = document.getElementById('patternCanvas');
        if (!canvas) {
            console.log('Canvas not found in updateCanvasStyle');
            return;
        }

        console.log('Updating canvas style. Edit mode:', this.isEditMode);

        if (this.isEditMode) {
            canvas.style.cursor = 'crosshair';
            canvas.title = 'Click to paint • Drag to select multiple • Ctrl+click for individual selection • Esc to clear selection';
            canvas.classList.add('edit-mode');
            console.log('Canvas set to edit mode');
        } else {
            canvas.style.cursor = 'default';
            canvas.title = 'Enable edit mode to modify stitches';
            canvas.classList.remove('edit-mode');
            console.log('Canvas set to view mode');
        }
        canvas.style.boxShadow = 'none';
        canvas.style.borderRadius = '0';
    }

    drawGrid(ctx, width, height, cellSize) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        
        // Draw vertical lines between pixels
        for (let x = 1; x < width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize - 0.5, 0);
            ctx.lineTo(x * cellSize - 0.5, height * cellSize);
            ctx.stroke();
        }
        
        // Draw horizontal lines between pixels
        for (let y = 1; y < height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize - 0.5);
            ctx.lineTo(width * cellSize, y * cellSize - 0.5);
            ctx.stroke();
        }
    }

    handleCanvasClick(event) {
        console.log('=== HANDLE CANVAS CLICK CALLED ===');
        console.log('Edit mode:', this.isEditMode, 'Mouse moved:', this.mouseHasMoved);
        
        // Only handle clicks if in edit mode and mouse wasn't dragged
        if (!this.isEditMode || this.mouseHasMoved) {
            console.log('Not in edit mode or mouse was dragged, ignoring click');
            this.mouseHasMoved = false; // Reset for next interaction
            return;
        }

        console.log('Canvas clicked in edit mode!', event);
        if (!this.currentPatternData || !this.cellSize) {
            console.log('Missing data:', { 
                hasPatternData: !!this.currentPatternData, 
                hasCellSize: !!this.cellSize,
                patternData: this.currentPatternData 
            });
            return;
        }
        
        const { x, y } = this.getCanvasCoordinates(event);
        
        console.log('Adjusted click position:', { x, y, cellSize: this.cellSize });
        
        // Calculate which stitch was clicked
        const stitchX = Math.floor(x / this.cellSize);
        const stitchY = Math.floor(y / this.cellSize);
        
        console.log('Stitch coordinates:', { stitchX, stitchY });
        console.log('Pattern dimensions:', { width: this.currentPatternData.width, height: this.currentPatternData.height });
        
        // Check bounds
        if (stitchX >= 0 && stitchX < this.currentPatternData.width && 
            stitchY >= 0 && stitchY < this.currentPatternData.height) {
            
            const stitchIndex = stitchY * this.currentPatternData.width + stitchX;
            
            // Handle Ctrl/Cmd+click for individual selection
            if (event.ctrlKey || event.metaKey) {
                if (this.selectedCells.has(stitchIndex)) {
                    this.selectedCells.delete(stitchIndex);
                } else {
                    this.selectedCells.add(stitchIndex);
                }
                this.redrawCanvasWithSelection();
                return;
            }
            
            // Regular single click - paint immediately if color is selected
            console.log('Painting stitch at index:', stitchIndex, 'with color:', this.selectedEditColor);
            
            if (this.selectedEditColor) {
                this.updateSingleStitch(stitchIndex, this.selectedEditColor);
            } else {
                console.log('No color selected for painting');
            }
        } else {
            console.log('Click outside bounds');
        }
        
        // Reset mouse moved flag
        this.mouseHasMoved = false;
    }

    handleCanvasContextMenu(event) {
        // Only handle right-clicks in edit mode
        if (!this.isEditMode || !this.currentPatternData) {
            return;
        }
        
        event.preventDefault(); // Prevent default context menu
        
        const { x, y } = this.getCanvasCoordinates(event);
        
        // Calculate which stitch was right-clicked
        const stitchX = Math.floor(x / this.cellSize);
        const stitchY = Math.floor(y / this.cellSize);
        
        // Check bounds
        if (stitchX >= 0 && stitchX < this.currentPatternData.width && 
            stitchY >= 0 && stitchY < this.currentPatternData.height) {
            
            // Store the position for row/column operations
            this.contextMenuRow = stitchY;
            this.contextMenuColumn = stitchX;
            
            // Show a brief visual indicator
            this.showContextPosition(stitchX, stitchY);
            
            this.showToast(`Position set: Row ${stitchY + 1}, Column ${stitchX + 1}`, 'info');
        }
    }

    showContextPosition(stitchX, stitchY) {
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Draw a temporary highlight
        ctx.save();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        const x = stitchX * this.cellSize;
        const y = stitchY * this.cellSize;
        
        ctx.strokeRect(x, y, this.cellSize, this.cellSize);
        ctx.restore();
        
        // Clear the highlight after 1 second
        setTimeout(() => {
            this.redrawCanvasWithSelection();
        }, 1000);
    }

    updateDownloadButtonText() {
        const projectName = this.getProjectName();
        const exportImageBtn = document.getElementById('exportImage');
        const exportPaletteBtn = document.getElementById('exportPalette');

        if (exportImageBtn) {
            exportImageBtn.textContent = `Download Pattern (${projectName}-pattern.png)`;
        }
        if (exportPaletteBtn) {
            exportPaletteBtn.textContent = `Download Color Guide (${projectName}-color-guide.png)`;
        }
    }

    handleCanvasMouseDown(event) {
        if (!this.isEditMode || !this.currentPatternData) return;
        
        this.isDragging = false; // Will be set to true if mouse moves
        this.dragStartPos = this.getCanvasCoordinates(event);
        this.mouseHasMoved = false;
        
        // Clear previous selection if not holding Ctrl/Cmd
        if (!event.ctrlKey && !event.metaKey) {
            this.selectedCells.clear();
            this.redrawCanvasWithSelection();
        }
        
        // Prevent text selection during drag
        event.preventDefault();
    }

    handleCanvasMouseMove(event) {
        if (!this.isEditMode || !this.currentPatternData || !this.dragStartPos) return;
        
        const currentPos = this.getCanvasCoordinates(event);
        
        // Check if mouse has moved significantly (more than 5 pixels)
        const distance = Math.sqrt(
            Math.pow(currentPos.x - this.dragStartPos.x, 2) + 
            Math.pow(currentPos.y - this.dragStartPos.y, 2)
        );
        
        if (distance > 5) {
            this.isDragging = true;
            this.mouseHasMoved = true;
            this.updateSelection(this.dragStartPos, currentPos);
            this.redrawCanvasWithSelection();
        }
        
        event.preventDefault();
    }

    handleCanvasMouseUp(event) {
        if (!this.isEditMode) return;
        
        // If we were dragging and have selected cells and a color is chosen, apply it
        if (this.isDragging && this.selectedCells.size > 0 && this.selectedEditColor) {
            this.updateSelectedCells();
        }
        
        // Reset drag state
        this.isDragging = false;
        this.dragStartPos = null;
        
        event.preventDefault();
    }

    getCanvasCoordinates(event) {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        
        return { x, y };
    }

    updateSelection(startPos, endPos) {
        if (!this.currentPatternData) return;
        
        // Calculate the selection rectangle in grid coordinates
        const startX = Math.floor(startPos.x / this.cellSize);
        const startY = Math.floor(startPos.y / this.cellSize);
        const endX = Math.floor(endPos.x / this.cellSize);
        const endY = Math.floor(endPos.y / this.cellSize);
        
        // Ensure coordinates are within bounds
        const minX = Math.max(0, Math.min(startX, endX));
        const maxX = Math.min(this.currentPatternData.width - 1, Math.max(startX, endX));
        const minY = Math.max(0, Math.min(startY, endY));
        const maxY = Math.min(this.currentPatternData.height - 1, Math.max(startY, endY));
        
        // Store selection rectangle
        this.selectionRect = { minX, minY, maxX, maxY };
        
        // Update selected cells
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const index = y * this.currentPatternData.width + x;
                this.selectedCells.add(index);
            }
        }
    }

    updateSelectedCells() {
        if (!this.selectedEditColor || this.selectedCells.size === 0) return;
        
        // Update all selected cells with the chosen color
        this.selectedCells.forEach(index => {
            this.updateSingleStitch(index, this.selectedEditColor);
        });
        
        // Clear selection after updating
        this.selectedCells.clear();
        this.selectionRect = null;
        this.redrawCanvasWithSelection();
        
        // Mark as having unsaved changes for auto-save
        this.hasUnsavedChanges = true;
    }

    redrawCanvasWithSelection() {
        if (!this.currentPatternData) return;
        
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const { width, height, pixels } = this.currentPatternData;
        
        // Clear and redraw the pattern
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw pattern cells
        pixels.forEach((color, index) => {
            const x = (index % width) * this.cellSize;
            const y = Math.floor(index / width) * this.cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, this.cellSize, this.cellSize);
        });
        
        // Draw grid if in edit mode
        if (this.isEditMode) {
            this.drawGrid(ctx, width, height);
        }
        
        // Draw selection overlay
        if (this.selectedCells.size > 0) {
            ctx.fillStyle = 'rgba(0, 123, 255, 0.3)'; // Blue overlay
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.lineWidth = 2;
            
            this.selectedCells.forEach(index => {
                const x = (index % width) * this.cellSize;
                const y = Math.floor(index / width) * this.cellSize;
                
                ctx.fillRect(x, y, this.cellSize, this.cellSize);
                ctx.strokeRect(x, y, this.cellSize, this.cellSize);
            });
        }
        
        // Draw selection rectangle during drag
        if (this.isDragging && this.selectionRect) {
            const { minX, minY, maxX, maxY } = this.selectionRect;
            const x = minX * this.cellSize;
            const y = minY * this.cellSize;
            const width = (maxX - minX + 1) * this.cellSize;
            const height = (maxY - minY + 1) * this.cellSize;
            
            ctx.strokeStyle = 'rgba(0, 123, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]); // Reset line dash
        }
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        
        // Draw vertical lines
        for (let x = 0; x <= width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.cellSize + 0.5, 0);
            ctx.lineTo(x * this.cellSize + 0.5, height * this.cellSize);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let y = 0; y <= height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.cellSize + 0.5);
            ctx.lineTo(width * this.cellSize, y * this.cellSize + 0.5);
            ctx.stroke();
        }
    }

    cycleStitchColor(stitchIndex) {
        if (!this.currentPatternData || !this.currentPatternData.palette) {
            return;
        }

        const currentColor = this.currentPatternData.pixels[stitchIndex];
        const palette = this.currentPatternData.palette;
        
        // Find current color index in palette
        let currentColorIndex = -1;
        for (let i = 0; i < palette.length; i++) {
            const paletteColor = palette[i];
            if (currentColor[0] === paletteColor[0] && 
                currentColor[1] === paletteColor[1] && 
                currentColor[2] === paletteColor[2]) {
                currentColorIndex = i;
                break;
            }
        }
        
        // Get next color in palette (cycle back to 0 if at end)
        const nextColorIndex = (currentColorIndex + 1) % palette.length;
        const nextColor = palette[nextColorIndex];
        
        console.log(`Cycling from color ${currentColorIndex} to ${nextColorIndex}`);
        
        // Update the stitch
        this.updateSingleStitch(stitchIndex, nextColor);
    }

    openStitchColorPicker(stitchIndex, stitchX, stitchY) {
        if (!this.currentPatternData) return;
        
        const currentColor = this.currentPatternData.pixels[stitchIndex];
        
        // Create stitch color picker modal
        const modal = document.createElement('div');
        modal.className = 'stitch-color-picker-modal';
        modal.innerHTML = `
            <div class="stitch-color-picker-content">
                <h4>Edit Stitch at Row ${stitchY + 1}, Column ${stitchX + 1}</h4>
                
                <div class="stitch-color-options">
                    <div class="palette-selection">
                        <h5>Choose from Pattern Colors:</h5>
                        <div class="palette-grid" id="stitchPaletteGrid"></div>
                    </div>
                </div>
                
                <div class="stitch-color-preview">
                    <div class="current-stitch">
                        <span>Current:</span>
                        <div class="stitch-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                    <div class="new-stitch" id="newStitchPreview">
                        <span>New:</span>
                        <div class="stitch-sample" style="background-color: rgb(${currentColor.join(', ')})"></div>
                    </div>
                </div>
                
                <div class="stitch-color-buttons">
                    <button id="applyStitchColor" class="apply-btn">Apply</button>
                    <button id="cancelStitchColor" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Populate palette grid
        const paletteGrid = modal.querySelector('#stitchPaletteGrid');
        this.currentPatternData.palette.forEach((color, index) => {
            const colorOption = document.createElement('div');
            colorOption.className = 'palette-color-option';
            colorOption.style.backgroundColor = `rgb(${color.join(', ')})`;
            colorOption.title = `Color ${index + 1} - RGB(${color.join(', ')})`;
            
            // Highlight current color
            if (currentColor[0] === color[0] && currentColor[1] === color[1] && currentColor[2] === color[2]) {
                colorOption.classList.add('selected');
            }
            
            colorOption.addEventListener('click', () => {
                // Remove previous selection
                paletteGrid.querySelectorAll('.palette-color-option').forEach(opt => 
                    opt.classList.remove('selected'));
                colorOption.classList.add('selected');
                
                // Update preview
                this.updateStitchPreview(color, modal);
                this.selectedStitchColor = color;
            });
            
            paletteGrid.appendChild(colorOption);
        });
        
        // Set initial selection
        this.selectedStitchColor = currentColor;
        
        // Button handling
        const applyBtn = modal.querySelector('#applyStitchColor');
        const cancelBtn = modal.querySelector('#cancelStitchColor');
        
        applyBtn.addEventListener('click', () => {
            if (this.selectedStitchColor) {
                this.updateSingleStitch(stitchIndex, this.selectedStitchColor);
            }
            document.body.removeChild(modal);
        });
        
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updateStitchPreview(color, modal) {
        const newStitchPreview = modal.querySelector('#newStitchPreview .stitch-sample');
        if (newStitchPreview) {
            newStitchPreview.style.backgroundColor = `rgb(${color.join(', ')})`;
        }
    }

    updateSingleStitch(stitchIndex, newColor) {
        if (!this.currentPatternData) return;
        
        // Update the pixel at the specific index
        this.currentPatternData.pixels[stitchIndex] = [...newColor];
        
        // Redraw only the affected stitch for performance
        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = this.currentPatternData.width;
        const height = this.currentPatternData.height;
        
        const x = (stitchIndex % width) * this.cellSize;
        const y = Math.floor(stitchIndex / width) * this.cellSize;
        
        // Redraw this stitch
        ctx.fillStyle = `rgb(${newColor[0]}, ${newColor[1]}, ${newColor[2]})`;
        ctx.fillRect(x, y, this.cellSize, this.cellSize);
        
        // Redraw the grid lines that intersect this cell
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        
        ctx.beginPath();
        // Only redraw interior grid lines (not outer borders)
        if (x > 0) {
            // Left line
            ctx.moveTo(x - 0.5, y);
            ctx.lineTo(x - 0.5, y + this.cellSize);
        }
        if (y > 0) {
            // Top line
            ctx.moveTo(x, y - 0.5);
            ctx.lineTo(x + this.cellSize, y - 0.5);
        }
        if (x + this.cellSize < width * this.cellSize) {
            // Right line
            ctx.moveTo(x + this.cellSize - 0.5, y);
            ctx.lineTo(x + this.cellSize - 0.5, y + this.cellSize);
        }
        if (y + this.cellSize < height * this.cellSize) {
            // Bottom line
            ctx.moveTo(x, y + this.cellSize - 0.5);
            ctx.lineTo(x + this.cellSize, y + this.cellSize - 0.5);
        }
        ctx.stroke();
    }

    displayColorPalette(palette) {
        const container = document.getElementById('paletteColors');
        if (!container) return;
        
        container.innerHTML = '';
        
        palette.forEach((color, index) => {
            const swatchContainer = document.createElement('div');
            swatchContainer.className = 'color-swatch-container';
            
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            swatch.textContent = index + 1;
            
            // Remove the click event for editing - editing is now only in edit mode
            
            swatchContainer.appendChild(swatch);
            container.appendChild(swatchContainer);
        });
    }

    openColorPicker(colorIndex) {
        if (!this.currentPatternData) return;
        
        // Create color picker modal
        const modal = document.createElement('div');
        modal.className = 'color-picker-modal';
        modal.innerHTML = `
            <div class="color-picker-content">
                <h4>Change Color ${colorIndex + 1}</h4>
                <div class="color-picker-section">
                    <label for="colorPicker">Choose new color:</label>
                    <input type="color" id="colorPicker" value="${this.rgbToHex(this.currentPatternData.palette[colorIndex])}">
                </div>
                <div class="color-preview">
                    <div class="current-color">
                        <span>Current:</span>
                        <div class="color-sample" style="background-color: rgb(${this.currentPatternData.palette[colorIndex].join(', ')})"></div>
                    </div>
                    <div class="new-color">
                        <span>New:</span>
                        <div class="color-sample" id="newColorSample" style="background-color: ${this.rgbToHex(this.currentPatternData.palette[colorIndex])}"></div>
                    </div>
                </div>
                <div class="color-picker-buttons">
                    <button id="applyColor" class="apply-btn">Apply</button>
                    <button id="cancelColor" class="cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const colorPicker = modal.querySelector('#colorPicker');
        const newColorSample = modal.querySelector('#newColorSample');
        const applyBtn = modal.querySelector('#applyColor');
        const cancelBtn = modal.querySelector('#cancelColor');
        
        // Update preview as user changes color
        colorPicker.addEventListener('input', (e) => {
            newColorSample.style.backgroundColor = e.target.value;
        });
        
        // Apply color change
        applyBtn.addEventListener('click', () => {
            const newColor = this.hexToRgb(colorPicker.value);
            this.updatePatternColor(colorIndex, newColor);
            document.body.removeChild(modal);
        });
        
        // Cancel color change
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    updatePatternColor(colorIndex, newColor) {
        if (!this.currentPatternData) return;
        
        const oldColor = this.currentPatternData.palette[colorIndex];
        
        // Update palette
        this.currentPatternData.palette[colorIndex] = newColor;
        
        // Update all pixels that use this color
        this.currentPatternData.pixels = this.currentPatternData.pixels.map(pixel => {
            if (pixel[0] === oldColor[0] && pixel[1] === oldColor[1] && pixel[2] === oldColor[2]) {
                return [...newColor];
            }
            return pixel;
        });
        
        // Redraw pattern and palette
        this.displayPattern(this.currentPatternData, this.currentPatternData.width, this.currentPatternData.height);
        this.displayColorPalette(this.currentPatternData.palette);
    }

    rgbToHex(rgb) {
        const r = rgb[0].toString(16).padStart(2, '0');
        const g = rgb[1].toString(16).padStart(2, '0');
        const b = rgb[2].toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    // Export Functions
    exportPatternImage() {
        if (!this.currentPatternData) {
            alert('Please generate a pattern first!');
            return;
        }

        const canvas = document.getElementById('patternCanvas');
        if (!canvas) return;

        // Get gridline setting
        const gridSizeInput = document.getElementById('gridSize');
        const gridSize = gridSizeInput ? parseInt(gridSizeInput.value) : 10;

        // Create high-resolution version for export
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        
        const cellSize = 20; // Fixed larger cells for better export quality
        const width = this.currentPatternData.width;
        const height = this.currentPatternData.height;
        
        exportCanvas.width = width * cellSize;
        exportCanvas.height = height * cellSize;
        
        // Draw pattern with grid
        this.currentPatternData.pixels.forEach((color, index) => {
            const x = (index % width) * cellSize;
            const y = Math.floor(index / width) * cellSize;
            
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, cellSize, cellSize);
            
            // Draw regular grid (thin lines)
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x, y, cellSize, cellSize);
        });

        // Draw thick gridlines every N stitches
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        
        // Vertical thick gridlines
        for (let x = 0; x <= width; x += gridSize) {
            const xPos = x * cellSize;
            ctx.beginPath();
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, height * cellSize);
            ctx.stroke();
        }
        
        // Horizontal thick gridlines
        for (let y = 0; y <= height; y += gridSize) {
            const yPos = y * cellSize;
            ctx.beginPath();
            ctx.moveTo(0, yPos);
            ctx.lineTo(width * cellSize, yPos);
            ctx.stroke();
        }

        // Download the image
        const projectName = this.getProjectName();
        this.downloadCanvas(exportCanvas, `${projectName}-pattern.png`);
    }

    exportColorGuide() {
        if (!this.currentPatternData) {
            alert('Please generate a pattern first!');
            return;
        }

        const palette = this.currentPatternData.palette;
        const craftType = document.getElementById('craftType').value;
        
        let stitchesPerInch;
        let sizeLabel;
        if (['knitting', 'crochet'].includes(craftType)) {
            stitchesPerInch = parseFloat(document.getElementById('yarnGauge').value);
            sizeLabel = `${stitchesPerInch} sts/inch gauge`;
        } else {
            stitchesPerInch = parseInt(document.getElementById('fabricCount').value);
            sizeLabel = `${stitchesPerInch}-count fabric`;
        }
        
        // Calculate material requirements for export
        const colorCounts = new Map();
        this.currentPatternData.pixels.forEach(pixel => {
            const colorKey = `${pixel[0]},${pixel[1]},${pixel[2]}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
        });
        
        const craftNames = {
            'knitting': 'KNITTING',
            'cross-stitch': 'CROSS-STITCH',
            'embroidery': 'EMBROIDERY',
            'crochet': 'CROCHET',
            'tapestry': 'TAPESTRY/NEEDLEPOINT'
        };

        // Create canvas for color guide
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate canvas dimensions - much more generous spacing
        const margin = 60;
        const swatchSize = 120;
        const swatchSpacing = 60;
        const colorBlockHeight = 300; // More space for each color
        const colorsPerRow = 1; // Only 1 color per row for maximum readability
        const rows = palette.length;
        
        const canvasWidth = 800; // Fixed width that's wide enough for all content
        const headerHeight = 180;
        const canvasHeight = margin * 2 + headerHeight + (colorBlockHeight * rows) + (swatchSpacing * (rows - 1)) + 80;
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Header
        ctx.fillStyle = '#2c3e50';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`COLOR GUIDE FOR ${craftNames[craftType]} PATTERN`, canvasWidth / 2, margin + 35);
        
        // Project info
        ctx.font = '18px Arial, sans-serif';
        ctx.fillText(`Generated: ${new Date().toLocaleDateString()}`, canvasWidth / 2, margin + 70);
        
        // Calculate finished size
        const finishedWidth = this.currentPatternData.width / stitchesPerInch;
        const finishedHeight = this.currentPatternData.height / stitchesPerInch;
        
        ctx.font = '16px Arial, sans-serif';
        ctx.fillText(`Pattern size: ${this.currentPatternData.width} x ${this.currentPatternData.height} stitches`, canvasWidth / 2, margin + 100);
        ctx.fillText(`Finished size: ${finishedWidth.toFixed(1)}" x ${finishedHeight.toFixed(1)}" | ${sizeLabel}`, canvasWidth / 2, margin + 125);
        
        // Add strand information for floss-based crafts in header
        let finalHeaderLine = `${palette.length} colors total`;
        if (craftType === 'cross-stitch' || craftType === 'embroidery' || craftType === 'tapestry') {
            const strandCount = document.getElementById('strandCount')?.value || 2;
            finalHeaderLine += ` | ${strandCount} strands of floss recommended`;
        }
        ctx.fillText(finalHeaderLine, canvasWidth / 2, margin + 150);
        
        // Draw color swatches and info
        palette.forEach((color, index) => {
            const x = margin;
            const y = margin + headerHeight + index * (colorBlockHeight + swatchSpacing);
            
            // Color swatch with border
            ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            ctx.fillRect(x, y, swatchSize, swatchSize);
            
            // Swatch border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, swatchSize, swatchSize);
            
            // Color information - positioned to the right of swatch with plenty of space
            const textX = x + swatchSize + 40;
            
            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`Color ${index + 1}`, textX, y + 35);
            
            const colorKey = `${color[0]},${color[1]},${color[2]}`;
            const stitchCount = colorCounts.get(colorKey) || 0;
            const yardage = this.calculateYardage(stitchCount, craftType, stitchesPerInch);
            
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText(`RGB: ${color[0]}, ${color[1]}, ${color[2]}`, textX, y + 70);
            ctx.fillText(`Hex: #${color[0].toString(16).padStart(2, '0')}${color[1].toString(16).padStart(2, '0')}${color[2].toString(16).padStart(2, '0')}`, textX, y + 95);
            ctx.fillText(`Stitches needed: ${stitchCount.toLocaleString()}`, textX, y + 120);
            ctx.fillText(`Estimated yardage: ${yardage} yards`, textX, y + 145);
            
            // Shopping lines with labels
            ctx.fillStyle = '#666666';
            ctx.font = '16px Arial, sans-serif';
            ctx.fillText('Brand purchased:', textX, y + 185);
            ctx.fillText('Color name:', textX, y + 215);
            ctx.fillText('Amount bought:', textX, y + 245);
            
            // Lines for writing - positioned properly
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            
            // Brand line
            ctx.beginPath();
            ctx.moveTo(textX + 140, y + 190);
            ctx.lineTo(textX + 400, y + 190);
            ctx.stroke();
            
            // Color name line
            ctx.beginPath();
            ctx.moveTo(textX + 110, y + 220);
            ctx.lineTo(textX + 400, y + 220);
            ctx.stroke();
            
            // Amount line
            ctx.beginPath();
            ctx.moveTo(textX + 120, y + 250);
            ctx.lineTo(textX + 400, y + 250);
            ctx.stroke();
        });
        
        // Footer notes
        const footerY = canvasHeight - margin;
        ctx.fillStyle = '#666666';
        ctx.font = '14px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💡 Estimates include 10% waste factor • Always purchase extra for color matching', canvasWidth / 2, footerY - 10);

        // Download the image
        const projectName = this.getProjectName();
        this.downloadCanvas(canvas, `${projectName}-color-guide.png`);
    }

    downloadCanvas(canvas, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = canvas.toDataURL();
        link.click();
    }

    getProjectName() {
        const projectNameInput = document.getElementById('projectName');
        const rawName = projectNameInput ? projectNameInput.value.trim() : '';
        
        // If no name provided, use default
        if (!rawName) {
            return 'My Pattern Project';
        }
        
        // Sanitize the project name for use in filenames
        return this.sanitizeFilename(rawName);
    }

    sanitizeFilename(name) {
        // Remove or replace characters that are invalid in filenames
        return name
            .replace(/[<>:"/\\|?*]/g, '') // Remove invalid characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/\.+$/, '') // Remove trailing dots
            .substring(0, 50) // Limit length
            .toLowerCase();
    }

    downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }
}
