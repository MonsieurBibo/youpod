function fetchFeed() {
    sel = document.getElementById("selectEp")
    sel.innerHTML = `<option selected value="__last__">Dernier épisode</option>`
    inp = document.getElementById("rss")
    
    myHeader = new Headers();
    myHeader.append("Origin", window.location.origin)

    fetch(window.location.origin + "/api/feed?url=" + inp.value, {
        "headers": myHeader
    })
        .then((res) => {
            if (res.ok)
                return res.json();
            else
                console.log(res)
        })    
        .then((json) => {
            json.data.forEach((e) => {
                o = document.createElement("option")
                o.innerHTML = e.title
                o.setAttribute("value", e.guid)
                o.setAttribute("audio", e.audio)

                sel.appendChild(o)
            })
            sel.removeAttribute("disabled")
			sel.removeChild(sel.querySelector("option"))
        })
}