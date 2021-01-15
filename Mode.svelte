<div>
    {#each modes as m}
    {#if (m == selected)} <b>{m}</b> {:else} <span on:click={setMode(m)}>{m}</span> {/if}
    {/each}
</div>

<script>
    let setMode = (m) => {
        selected = m
    }
    export let selected
    export let modes
</script>

<style>
    div {
        display: inline-block
    }
    div > b, div > span {
        margin-right: 4px;
        padding: 0px 2px;
    }
    div > b {
        background-color: skyblue;
    }
    div > span {
        background-color:rgba(0,0,0,0.12);
    }

</style>