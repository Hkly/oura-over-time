// Generate placeholder data for the contribution graphs
function generatePlaceholderData() {
    const data = [];
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    let currentDate = new Date(oneYearAgo);
    
    while (currentDate <= today) {
        // Generate random activity level (0-4)
        const level = Math.floor(Math.random() * 5);
        data.push({
            date: new Date(currentDate),
            level: level
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return data;
}

// Create a contribution graph
function createContributionGraph(containerId, data) {
    const container = document.getElementById(containerId);
    
    // Create graph container
    const graphContainer = document.createElement('div');
    graphContainer.className = 'graph-container';
    
    // Create months header
    const monthsDiv = document.createElement('div');
    monthsDiv.className = 'graph-months';
    
    // Create graph body
    const graphBody = document.createElement('div');
    graphBody.className = 'graph-body';
    
    // Create weekday labels
    const weekdayLabels = document.createElement('div');
    weekdayLabels.className = 'weekday-labels';
    const weekdays = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    weekdays.forEach(day => {
        const label = document.createElement('div');
        label.className = 'weekday-label';
        label.textContent = day;
        weekdayLabels.appendChild(label);
    });
    
    // Create grid
    const graphGrid = document.createElement('div');
    graphGrid.className = 'graph-grid';
    graphGrid.style.display = 'flex';
    graphGrid.style.gap = '3px';
    
    // Group data by weeks
    const weeks = [];
    let currentWeek = [];
    
    // Pad the start to align with Sunday
    const firstDate = data[0].date;
    const firstDay = firstDate.getDay();
    for (let i = 0; i < firstDay; i++) {
        currentWeek.push(null);
    }
    
    // Add all data
    data.forEach(item => {
        currentWeek.push(item);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });
    
    // Pad the end
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }
    
    // Track months for header
    let currentMonth = null;
    let monthPositions = [];
    
    // Create columns for each week
    weeks.forEach((week, weekIndex) => {
        const column = document.createElement('div');
        column.className = 'graph-column';
        
        week.forEach((day, dayIndex) => {
            const cell = document.createElement('div');
            cell.className = 'graph-cell';
            
            if (day) {
                cell.classList.add(`level-${day.level}`);
                cell.title = `${day.date.toLocaleDateString()}: Level ${day.level}`;
                
                // Track month changes for header
                const month = day.date.getMonth();
                if (currentMonth !== month) {
                    currentMonth = month;
                    if (dayIndex === 0 || weekIndex === 0) {
                        monthPositions.push({
                            month: month,
                            position: weekIndex
                        });
                    }
                }
            } else {
                cell.style.visibility = 'hidden';
            }
            
            column.appendChild(cell);
        });
        
        graphGrid.appendChild(column);
    });
    
    // Add month labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let lastPosition = 0;
    monthPositions.forEach((item, index) => {
        const monthLabel = document.createElement('div');
        monthLabel.className = 'month-label';
        monthLabel.textContent = monthNames[item.month];
        
        // Calculate width based on position
        const width = index < monthPositions.length - 1 
            ? (monthPositions[index + 1].position - item.position) * 15 
            : (weeks.length - item.position) * 15;
        
        monthLabel.style.width = `${width}px`;
        monthLabel.style.textAlign = 'left';
        monthsDiv.appendChild(monthLabel);
    });
    
    // Assemble graph
    graphBody.appendChild(weekdayLabels);
    graphBody.appendChild(graphGrid);
    
    graphContainer.appendChild(monthsDiv);
    graphContainer.appendChild(graphBody);
    
    // Add legend
    const legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
        <span class="legend-label">Less</span>
        <div class="legend-cell level-0"></div>
        <div class="legend-cell level-1"></div>
        <div class="legend-cell level-2"></div>
        <div class="legend-cell level-3"></div>
        <div class="legend-cell level-4"></div>
        <span class="legend-label">More</span>
    `;
    
    graphContainer.appendChild(legend);
    container.appendChild(graphContainer);
}

// Initialize all graphs when the page loads
document.addEventListener('DOMContentLoaded', function() {
    // Generate placeholder data for each graph
    const sleepData = generatePlaceholderData();
    const activityData = generatePlaceholderData();
    const meditationData = generatePlaceholderData();
    
    // Create the graphs
    createContributionGraph('sleep-graph', sleepData);
    createContributionGraph('activity-graph', activityData);
    createContributionGraph('meditation-graph', meditationData);
});
