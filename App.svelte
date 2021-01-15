<script>
    import { writable } from "svelte/store";
    import { v4 as uuidv4 } from "uuid";

    // lp logical point (state.points)
    // ap actual point (point.ghosts)

    let state = writable({
        // append only
        points: {},
        // "state" (all the leafs)
        leafs: {},
    });

    let freshId = () => uuidv4().slice(0, 16);
    let freshLabel = (() => {
        var c = 1;
        return () => `pt${c++}`;
    })();

    function addPoint(pointLabel) {
        let pointId = freshId();
        let oldState = $state;
        oldState.points[pointId] = {
            pointId,
            pointLabel,
            ghosts: {},
        };
        
        // empty set of leafs
        oldState.leafs[pointId] = {}
        
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
        oldState.leafs[pointId][ghostId] = true
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
        let newGhost = {
            pointId,
            pointLabel,
            ghostId,
            previousId,
            data: {
                x: shadow.x,
                y: shadow.y,
                owner: shadow.sessionUser,
            },
        };

        // add new ghost to state
        oldState.points[pointId].ghosts[ghostId] = newGhost;

        // remove old ghost from leafset, add new ghost
        oldState.leafs[pointId][previousId] = false
        oldState.leafs[pointId][ghostId] = true

        $state = oldState;
    }

    function isLeafSetMember(ghost) {
        let isMember = $state.leafs[ghost.pointId][ghost.ghostId]
        return isMember
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
            let pointId = addPoint(freshLabel());
            let ghostId = addGhost(pointId, {
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
            shadow = {
                x: evt.clientX,
                y: evt.clientY,
                ghostOwner: drag.data.owner,
                sessionUser: "JH",
            };
        }
    };

    // radius
    let r = 7;

    let showHistory = true
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
                {#if (showHistory || (!showHistory && isLeafSetMember(ghost)))}
                <circle
                    class="pt {isLeafSetMember(ghost) ? 'active' : 'historic'}"
                    cx={ghost.data.x}
                    cy={ghost.data.y}
                    style={`fill: #${ghost.pointId.slice(0, 6)}`}
                    {r}
                    on:mouseenter={mouseOver(ghost)}
                    on:mousedown={mouseDown(ghost)}
                />
                <text
                    class="ghost-label"
                    x={ghost.data.x}
                    y={ghost.data.y + r + 8}
                    >{point.pointLabel}.{ghost.data.owner || ""}</text
                >
                {/if}
            {/each}
        </g>
    {/each}

    {#if shadow}
        <circle class="drag-shadow" cx={shadow.x} cy={shadow.y} r={10} />
    {/if}
</svg>

<input type="checkbox" bind:checked={showHistory}>show history

<div>
    {#each Object.values($state.points) as pt}
        <span class="point">{pt.pointId}</span>
    {/each}
</div>

<pre>
showHistory = {showHistory}
over = {JSON.stringify(over,null,2)}{#if over}<br>isLeafSetMember = {isLeafSetMember(over)}{/if}
shadow = {JSON.stringify(shadow)}
drag = {JSON.stringify(drag,null,2)}
</pre>

</div>

<div>
append only log
<pre>
{#each Object.values($state.points) as point}
P {point.pointId}
{#each Object.values(point.ghosts) as ghost}
  * G {ghost.ghostId} <span color="gray">{#if ghost.previousId}P {ghost.previousId}{/if}</span> -- {ghost.data.owner} {ghost.data.x} {ghost.data.y}<br/>
{/each}
<br/>
{/each}
</pre>
<hr>
folded state
<pre>
{#each Object.keys($state.leafs) as leafPt}
{leafPt} Point
{#each Object.keys($state.leafs[leafPt]).filter(k => $state.leafs[leafPt][k]) as activeGhost}
  * {activeGhost}<br/>
{/each}
<br/>
{/each}
</pre>
</div>
<div style="border-left: 1px solid #ccc">
<pre>
state = {JSON.stringify($state,null,2)}
</pre>
</div>
</div>


<style>
    .lower { display: flex }
    .lower > div { flex: 1 }
    svg {
        border: 1px solid gray;
        width: 100%;
        height: 300px;
    }
    .pt {
        stroke-width: 3;
    }
    .historic {
        stroke: rgba(0, 0, 0, 0.24);
        fill: rgba(0, 0, 0, 0.24) !important;
    }
    .active {
        stroke: rgba(0,0,0,0.9);
    }
    .ghost-label {
        font-size: 10px;
    }
    .point {
        background: navajowhite;
        border: 1px solid royalblue;
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
</style>
