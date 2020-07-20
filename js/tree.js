async function drawChart(){

  // 1. Access Data
  const nodes_data = await d3.json("./data/treeData.json")
  
  const levelAccessor = d => d.data.Level
  const batchNumAccessor = d => d.data.BatchNum
  const matNumAccessor = d => d.data.MaterialNum
  const matDescAccessor = d => d.data.Description 
  const siteAccessor = d => d.data.Plant
  const batchDOMAccessor = d => d.data.DOM 
  
  tree = data => {
    const root = d3.stratify()(data);
    root.dx = 5;
    root.dy = dimensions.height / (root.height + 1);
    return d3.tree()
            .nodeSize([root.dx, root.dy])
            .size([
              dimensions.boundedWidth - dimensions.nodeRadius,
              dimensions.boundedHeight - dimensions.nodeRadius
            ])(root);
  }

  // 2. Create Chart Dimensions

  let dimensions = {
    width: 700,
    height: 500,
    nodeRadius: 20,
    margin: {
      top: 25,
      right: 25,
      bottom: 25,
      left: 25,
    },
  }
  dimensions.boundedWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right
  dimensions.boundedHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom

  // 3. Draw Canvas

  const wrapper = d3.select("#treeWrapper")
    .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)

  const bounds = wrapper.append("g")
    .attr("id", "vizBounds")
    .style("transform", `translate(${
      dimensions.margin.left 
    }px, ${
      dimensions.margin.top
    }px)`)

  // init static elements
  const defs = wrapper.append("defs")

  // arrow markers
  const arrowId = "linkArrow"
  const arrowMarkers = defs.append("marker")
    .attr("id", arrowId)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 6 + dimensions.nodeRadius)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("class", "linkLine")
    .attr("d", "M0,-5L10,0L0,5")

  bounds.append("g")
    .attr("id", "link-layer")

  bounds.append("g")
    .attr("id", "node-layer")

  bounds.append("g")
    .attr("id", "legend")

  const lineGenerator = d3.line()
    .x(d => d.x)
    .y(d => d.y)
  
  // 4. Create Scales
  const drawTree = revealIndex => {

    let visibleNodes = nodes_data.filter(d => d.Reveal <= revealIndex)
      .map(d => JSON.parse(JSON.stringify(d)))
    const nodeIds = visibleNodes.map(d => d.id)
    
    visibleNodes.forEach((d, index) => {
      if(!nodeIds.includes(d.parentId ? d.parentId:d.id)) 
        delete d.parentId;
    })

    const root = tree(visibleNodes)
  
    let x0 = Infinity;
    let x1 = -x0;
    root.each(d => {
      if (d.x > x1) x1 = d.x;
      if (d.x < x0) x0 = d.x;
    });

    const materialTypes = [...new Set(root.descendants().map(matNumAccessor))]
    const stageCodes = ["Packaged Goods", "Finished Tablets", "Bulk Tablets", "Formulated Blend", "Granulated API"]

    const stageScale = d3.scaleOrdinal()
      .domain(d3.range(0, 5))
      .range(stageCodes)

    const levelColorScale = d3.scaleOrdinal()
      .domain(stageScale.domain())
      //.range(d3.schemeCategory10)
      .range(["#9AC92E", "#00877C", "#662046", "#37424A", "#6ECEB2"])

    // 5. Draw Data

    const exitTransition = d3.transition().duration(500)
    const moveTransition = exitTransition.transition().duration(500)
    const addTransition = moveTransition.transition().duration(500)
    const linkTransition = addTransition.transition().duration(200)

    // remove, add, update links
    let linkGroups = bounds.select("#link-layer")
      .selectAll(".linkGroup")
      .data(root.links(), d => d.source.id + "_" + d.target.id)

    const oldLinkGroups = linkGroups.exit()

    oldLinkGroups.selectAll("path")
      .transition(exitTransition)
        .attr("marker-end", "")
        .attr("d", "M 0,0")

    oldLinkGroups
      .transition(exitTransition)
        .remove()

    const newLinkGroups = linkGroups.enter().append("g")
      .attr("class", "linkGroup")

    newLinkGroups.append("path")
        .attr("class", "linkLine")
         .attr("d", d => "M" + d.source.x + "," + d.source.y)
        .style("opacity", 0)

    linkGroups = newLinkGroups.merge(linkGroups)

    const links = linkGroups.select("path")
      .transition(moveTransition)
        .attr("d", d => lineGenerator([d.source, d.target]))
      .transition(linkTransition)
        .attr("marker-end", `url(#${arrowId})`)
        .style("opacity", 1)

    // remove, add, update nodes
    let nodeGroups = bounds.select("#node-layer")
      .selectAll(".nodeGroup")
      .data(root.descendants(), d => d.data.id)

    const oldNodeGroups = nodeGroups.exit()

    oldNodeGroups.selectAll("circle")
      .transition(exitTransition)
        .attr("cy", 0)
        .attr("cx", 0)
        .attr("r", 1)

    oldNodeGroups.selectAll("rect")
      .transition(exitTransition)
        .attr("x", 0)
        .attr("y", 25) 

    oldNodeGroups.selectAll("text")
      .transition(exitTransition)
        .text("")

        
    oldNodeGroups
      .transition(exitTransition)
        .remove()

    const newNodeGroups = nodeGroups.enter().append("g")
      .attr("class", "nodeGroup")

    newNodeGroups.append("circle")
        .attr("transform", d => `translate(${d.x},${d.y})`)
        .attr("fill", "transparent")
        .attr("r", 0)
      .on("mouseenter", onMouseEnter)
      .on("mouseleave", onMouseLeave)

    const label_dy = 20
    newNodeGroups.append("rect")
      .attr("y", d => d.y + dimensions.nodeRadius + label_dy / 2 - 5)
      .attr("x", d => d.x - 50)
      .attr("width", 0)
      .attr("height", 0)
      .attr("fill", "transparent")

    newNodeGroups.append("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y + dimensions.nodeRadius + label_dy)
      .attr("class", "batch-label")
      
    nodeGroups = newNodeGroups.merge(nodeGroups)

    const nodes = nodeGroups.select("circle")
      .transition(moveTransition)
        .attr("fill", d => levelColorScale(levelAccessor(d)))
        .attr("transform", d => `translate(${d.x},${d.y})`)
      .transition(addTransition)
        .attr("r", dimensions.nodeRadius)

    const labelBackgrounds = nodeGroups.select("rect")
      .transition(moveTransition)
        .attr("y", d => d.y + dimensions.nodeRadius + label_dy / 2 - 5)
        .attr("x", d => d.x - 50)
      .transition(moveTransition).duration(50)
        .attr("width", 100)
        .attr("height", 20)
        .attr("fill", "#f8f9fa")

    const labels = nodeGroups.select("text")
      .transition(moveTransition)
        .attr("x", d => d.x)
        .attr("y", d => d.y + dimensions.nodeRadius + label_dy)
      .transition(addTransition)
        .text(batchNumAccessor)

    // 6. Draw Peripherals

    const levelsShown = [...new Set(root.descendants().map(d => levelAccessor(d)))].sort().reverse()    
    let legend = bounds.select("#legend")
        .attr("transform", `translate(${
          root.x + 200
        }, ${
          root.y
        })`)
      .selectAll(".legendEntry")
      .data(levelsShown, d => d)

    const oldEntries = legend.exit()

    oldEntries.selectAll("circle")
      .transition(exitTransition)
        .attr("cy", 0)
        .attr("cx", 0)
        .attr("r", 1)

    oldEntries.selectAll("text")
      .transition(exitTransition)
        .text("")

    oldEntries
        .transition(exitTransition)
          .remove()

    const newEntries = legend.enter().append("g")
        .attr("class", "legendEntry")
    
    newEntries.append("circle")
      .attr("cx", 5)
      .attr("cy", d => levelsShown.indexOf(d) * 25)
      .attr("r", 0)
      .attr("fill", "transparent")

    newEntries.append("text")
        .attr("x", 20)

    legend = newEntries.merge(legend)
    
    const legendIcons = legend.select("circle")
      .transition(moveTransition)
        .attr("cx", 5)
        .attr("cy", d => levelsShown.indexOf(d) * 25)
        .attr("fill", d => levelColorScale(d))
      .transition(addTransition)
        .attr("r", 10)        

    const legendText = legend.select("text")
      .transition(moveTransition)
        .attr("y", d => levelsShown.indexOf(d) * 25 + 5)
      .transition(addTransition)
        .text(d => stageScale(d))

  }

  let progressIndex = 0
  drawTree(progressIndex)

  // 7. Interactions
  
  const tooltip = d3.select("#tooltip")
  const tooltipLine = bounds.append("path")
    .attr("class", "tooltip-line")

  const getAngle = (x, y) => Math.atan2(y, x)

  function onMouseEnter(e) {

    let angle = getAngle(100 - e.y, e.x - (200 / 2)) + Math.PI
    if (angle < 0) angle = (Math.PI * 2) + angle
    const outerR = Math.sqrt((e.y - 100)**2 + (e.x - 10 -275/2)**2)
    
    const tooltipArcGenerator = d3.arc()
      .innerRadius(0)
      .outerRadius(outerR)
      .startAngle(angle - 0.015)
      .endAngle(angle + 0.03)

    tooltipLine.attr("d", tooltipArcGenerator())
      .style("opacity", 1)
      .style("transform", `translate(${
        e.x
      }px, ${
        e.y
      }px)`)

    tooltip.style("opacity", 1)

    tooltip.select("#tooltip-batchNum")
      .text(batchNumAccessor(e))

    tooltip.select("#tooltip-site")
      .text(siteAccessor(e))

    const batchDOM = d3.timeParse("%Y%m%d")(batchDOMAccessor(e))
    tooltip.select("#tooltip-batchDOM")
      .text(d3.timeFormat("%B %-d, %Y")(batchDOM))

    tooltip.select("#tooltip-matDesc")
      .text(matDescAccessor(e))

  }

  bounds.insert("rect", ":first-child")
    .attr("id", "actionBox")
    .attr("width", "100%")//dimensions.boundedWidth)
    .attr("height", "100%")//dimensions.boundedHeight)
    .style("fill", "transparent")
    .style("transform", `translate(${
      -dimensions.margin.left
    }px, ${
     -dimensions.margin.top
    }px)`)
    .on("click", onClick)

  function onMouseLeave(e) {
    tooltip.style("opacity", 0)
    tooltipLine.style("opacity", 0)
  }

  function onClick() {
    progressIndex = (progressIndex + 1) % (3)
    drawTree(progressIndex)
  }

}

