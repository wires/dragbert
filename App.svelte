<script>
    import Mode from "./Mode.svelte";
    import { writable } from "svelte/store";
    import { v4 as uuidv4 } from "uuid";

    let empty = {
        // append only
        points: {},
        // "state" (all the leafs)
        leafs: {},
        // raw log
        logEntries: [],
    }
    let state = writable({...empty});
    function reset () {
        $state.points = {}
        $state.leafs = {}
        $state.logEntries = []
        console.log('reset', $state)
    }

    //let freshId = () => uuidv4().slice(0, 16);
    let freshId = (() => {
        var c = 1;
        return () => `#${c++}`;
    })();

    let freshLabel = (() => {
        var c = 1;
        return () => `pt${c++}`;
    })();

    //let ghostColor = (pointId) => "#" + pointId.slice(2, 8);
    // lol
    let colors = []
    for(var i = 0; i<100; i++){ colors.push(uuidv4().slice(2,8)) }

    let ghostColor = (pointId, entangled) => !entangled
        ? "#" + colors[parseInt(pointId.slice(1)) % colors.length]
        : "#" + colors[parseInt(pointId.slice(1)) % colors.length] + '80'

    function addPoint(pointLabel) {
        let pointId = freshId();
        let oldState = $state;
        oldState.points[pointId] = {
            pointId,
            pointLabel,
            ghosts: {},
        };

        // empty set of leafs
        oldState.leafs[pointId] = {};

        $state = oldState;
        return pointId;
    }

    function addGhost(pointId, data) {
        let oldState = $state;
        let ghostId = freshId();
        let point = oldState.points[pointId];
        point.ghosts[ghostId] = {
            ghostId,
            pointId,
            pointLabel: point.pointLabel,
            data,
        };
        oldState.leafs[pointId][ghostId] = true;
        $state = oldState;
        return ghostId;
    }

    function updatePoint(ghost, shadow) {
        let oldState = $state;
        let pointId = ghost.pointId;
        let pointLabel = oldState.points[pointId].pointLabel;
        let previousId = ghost.ghostId;
        // create new point (remember, append only)
        let ghostId = freshId();
        let data = {
            x: shadow.x,
            y: shadow.y,
            owner: shadow.sessionUser,
        };
        let newGhost = {
            pointId,
            pointLabel,
            ghostId,
            previousId,
            data,
        };

        // add new ghost to state
        oldState.points[pointId].ghosts[ghostId] = newGhost;

        // remove old ghost from leafset, add new ghost
        oldState.leafs[pointId][previousId] = false;
        oldState.leafs[pointId][ghostId] = true;

        oldState.logEntries.push({
            op: "UP",
            pointId,
            pointLabel,
            ghostId,
            previousId,
            data,
        });

        $state = oldState;
    }

    function createPoint(data) {
        let pointLabel = freshLabel();
        let pointId = addPoint(pointLabel);
        let ghostId = addGhost(pointId, data);
        let oldState = $state;
        oldState.logEntries.push({
            op: "CR",
            pointId,
            pointLabel,
            ghostId,
            data,
        });
        $state = oldState;
        return ghostId;
    }

    function isLeafSetMember(ghost) {
        let isMember = $state.leafs[ghost.pointId][ghost.ghostId];
        return isMember;
    }

    function isEntangled(pointId) {
        let leafs = Object.values($state.leafs[pointId]).filter(l => l)
        return leafs.length > 1
    }

    // let ptId1 = addPoint(freshLabel());
    // let gId1 = addGhost(ptId1, { x: 22, y: 23, owner: "B" });

    // let ptId2 = addPoint(freshLabel());
    // let gId2 = addGhost(ptId2, { x: 82, y: 33, owner: "B" });
    // // let gId3 = addGhost(ptId2, { x: 50, y: 13, owner: 'J' });

    // let ptId3 = addPoint(freshLabel());
    // let gId4 = addGhost(ptId3, { x: 122, y: 33, owner: "B" });
    // // let gId5 = addGhost(ptId3, { x: 150, y: 13, owner: 'J' });

    let drag = false;
    let shadow = false;
    let over = false;
    let mouseOver = (ghost) => () => {
        over = ghost;
    };
    let mouseOut = () => {
        over = false;
    };
    let mouseDown = (ghost) => () => {
        console.log("mouse down");
        drag = ghost;
    };
    // create
    let mouseDownSvg = (evt) => {
        // not over circle
        if (!over) {
            createPoint({
                x: evt.clientX,
                y: evt.clientY,
                owner: "JH", // session user
            });
        }
    };
    let mouseUp = () => {
        console.log("mouse up");
        if (drag) {
            // drag.data.x = shadow.x;
            // drag.data.y = shadow.y;
            updatePoint(drag, shadow);
            // console.log('DRAG UPDATE', drag)
            drag = false;
            shadow = false;
            // return true;
        }
    };
    let mouseMove = (evt) => {
        if (drag) {
            let x = evt.clientX
            let y = evt.clientY
            let colliding = collisionDetect(drag, {x,y})
            shadow = {
                x, y,
                colliding,
                ghostOwner: drag.data.owner,
                sessionUser: "JH",
            };
        }
    };

    // radius
    let r = 7;

    // check if point is near/colling other
    function distance({x,y}, pt2) {
        let dx = x - pt2.x
        let dy = y - pt2.y
        return Math.sqrt(dx * dx + dy * dy)
    }
    let actualLeafs = (pointId, except = false) => {
        let leafs = $state.leafs[pointId]
        console.log('LEAFS', leafs)
        let al = Object.values($state.points[pointId].ghosts)
            // .map(g => ({isLeaf: leafs[g.ghostId], ...g}))
            .filter(g => leafs[g.ghostId])//g.isLeaf) // only active leafs
            .filter(g => g.ghostId != except) // except this one
        console.log('AL', al)
        return al
    }

    function collisionDetect(ghost, currentPos) {
        // if we check all ghosts, we can merge different logical points
        // if we check only ghosts for one logical point, we disallow this
        let pt1 = currentPos || ghost.data
        let pointId = ghost.pointId
        let otherActualGhosts = actualLeafs(pointId, ghost.ghostId)
        var colliding = []
        for(var g of otherActualGhosts) {
            let d = distance(pt1, g.data)
            console.log(`DISTANCE ${ghost.ghostId}·--·${g.ghostId}`, {d,g,ghost})
            if(d < 20){
                colliding.push(g)
            }
        }
        return colliding
    }

    let isColliding = () => {
        if (shadow && shadow.colliding) {
            return shadow.colliding.length > 0
        }
        return false
    }

    let showHistory = true;
    let logMode = "raw";
    let showState = "show";
</script>

<div class="lower">
    <div>
        <svg
            viewport="0 0 100 100"
            on:mousemove={mouseMove}
            on:mouseup={mouseUp}
            on:mouseout={mouseOut}
            on:mousedown={mouseDownSvg}>
            {#if showHistory}
                <g>
                    {#each Object.values($state.points) as point}
                        {#each Object.values(point.ghosts) as ghost}
                            {#if ghost.previousId}
                                <line
                                    x1={ghost.data.x}
                                    y1={ghost.data.y}
                                    x2={point.ghosts[ghost.previousId].data.x}
                                    y2={point.ghosts[ghost.previousId].data.y}
                                    stroke="gray"
                                />
                            {/if}
                        {/each}
                    {/each}
                </g>
            {/if}
            {#each Object.values($state.points) as point}
                <g>
                    {#each Object.values(point.ghosts) as ghost}
                        <!-- TODO create "cssStateName" fn, active/historic/deleted -->
                        {#if showHistory || (!showHistory && isLeafSetMember(ghost))}
                            <circle
                                class="pt {isLeafSetMember(ghost) ? 'active' : 'historic'}"
                                cx={ghost.data.x}
                                cy={ghost.data.y}
                                style={`
                                    fill: ${ghostColor(ghost.pointId, isEntangled(point.pointId))};
                                    ${isEntangled(point.pointId) ? 'stroke-dasharray: 2;' : ''};
                                    stroke-width: ${isEntangled(point.pointId) ? '1' : '3'}
                                `}
                                r={r}
                                on:mouseenter={mouseOver(ghost)}
                                on:mousedown={mouseDown(ghost)}
                            />
                            <text
                                class="ghost-label"
                                x={ghost.data.x}
                                y={ghost.data.y + r + 8}
                                >{point.pointLabel}.{ghost.data.owner ||
                                    ""}</text
                            >
                        {/if}
                    {/each}
                </g>
            {/each}

            {#if shadow}
                <circle
                    class="drag-shadow {shadow.colliding.length > 0 ? 'collision' : ''}"
                    cx={shadow.x}
                    cy={shadow.y}
                    r={10}
                />
                {#if shadow.colliding.length}
                    <text x={shadow.x + 10} y={shadow.y -20}>Merge with {shadow.colliding.map(g => g.ghostId).join(", ")}</text>
                {/if}
            {/if}
        </svg>

        <div class="show-history">
            <input type="button" value="reset" on:click={reset} />
            <input type="checkbox" bind:checked={showHistory} />show history
        </div>

        <div class="point-ids">
            {#each Object.values($state.points) as pt}
                <span
                    style="background-color: {ghostColor(pt.pointId)}"
                    class="point">{pt.pointId}</span
                >
            {/each}
        </div>

        <pre>
showHistory={showHistory} logMode={logMode} showState={showState}
over = {JSON.stringify(over,null,2)}{#if over}<br>isLeafSetMember = {isLeafSetMember(over)}{/if}
shadow = {JSON.stringify(shadow,null,2)}
drag = {JSON.stringify(drag,null,2)}
</pre>
    </div>

    <div>
        <Mode bind:selected={logMode} modes={"pretty raw".split(" ")} />
        append only log

        <pre>
    {#if (logMode=="pretty")}
{#each Object.values($state.points) as point}
P {point.pointId}
{#each Object.values(point.ghosts) as ghost}
  * G {ghost.ghostId} <span color="gray">{#if ghost.previousId}P {ghost.previousId}{/if}</span> -- {ghost.data.owner} {ghost.data.x} {ghost.data.y}<br/>
{/each}
<br/>
{/each}
{:else}
<table>
    <thead>
        <th>OP</th>
        <th>Point Id</th>
        <th>Label</th>
        <th>Copy Id</th>
        <th>Previous Id</th>
        <th>Data</th>
    </thead>
{#each $state.logEntries as logEntry}
<tbody>
<tr>
    <td>{logEntry.op}</td>
    <td>{logEntry.pointId}</td>
    <td>{logEntry.pointLabel}</td>
    <td>{logEntry.ghostId}</td>
    <td>{logEntry.previousId || ''}</td>
    <td>{JSON.stringify(logEntry.data)}</td>
</tr>
</tbody>
{/each}
</table>
{/if}
</pre>
        <hr />
        folded state
        <pre>
{#each Object.keys($state.leafs) as leafPt}
{leafPt} Point {isEntangled(leafPt) ? '(entangled)' : ''} clr={ghostColor(leafPt, isEntangled(leafPt))}
{#each Object.keys($state.leafs[leafPt]).filter(k => $state.leafs[leafPt][k]) as activeGhost}
  * {activeGhost}<br/>
{/each}
<br/>
{/each}
</pre>
    </div>
    <div style="border-left: 1px solid #ccc">
        <Mode bind:selected={showState} modes={"show hide".split(" ")} /> state
        {#if showState == "show"}
            <pre>
state = {JSON.stringify($state,null,2)}
</pre>
        {/if}
    </div>
</div>

<style>
    .drag-shadow {
        stroke-dasharray: 2;
        stroke-width: 1;
        fill: none;
        stroke:rgba(0, 0, 0, 0.9)
    }
    .drag-shadow.collision {
        fill: red!important;
    }
    
    .lower {
        display: flex;
    }
    .lower > div {
        flex: 1;
    }
    svg {
        border: 1px solid gray;
        width: 100%;
        height: 300px;
        user-select: none;
    }
    .historic {
        stroke: rgba(0, 0, 0, 0.24);
        fill: rgba(0, 0, 0, 0.24) !important;
    }
    .active {
        stroke: rgba(0, 0, 0, 0.9);
    }
    .ghost-label {
        font-size: 10px;
    }
    .point {
        /* background: navajowhite;
        border: 1px solid royalblue; */
        margin: 4px;
    }
    pre {
        margin-left: 1em;
    }
    hr {
        margin: 1px;
        border: none;
        border-top: 1px solid gray;
        height: 0px;
    }
    .show-history {
        background-color: rgba(0, 0, 0, 0.24);
        padding: 4px;
    }
    .point-ids {
        background-color: rgba(0, 0, 0, 0.12);
        padding: 4px;
    }

    table {
        border: solid 1px #ddeeee;
        border-collapse: collapse;
        border-spacing: 0;
    }
    table thead th {
        background-color: #ddefef;
        border: solid 1px #ddeeee;
        color: #336b6b;
        padding: 4px;
        text-align: left;
    }
    table tbody td {
        border: solid 1px #ddeeee;
        color: #333;
        padding: 4px;
    }
</style>
