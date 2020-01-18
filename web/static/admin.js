function flushVideo() {
    fetch("/admin/action", {
        method: "POST",
        headers : {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({action: "flush_video"})
    }).then(() => {
        window.location.reload()
    })
}

function flushList() {
    fetch("/admin/action", {
        method: "POST",
        headers : {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({action: "flush_list"})
    }).then(() => {
        window.location.reload()
    })
}

fetch("/admin/queue")
    .then((data) => {
        return data.json()
    })
    .then((json) => {
        console.log(json)
        table = document.getElementById("queue")
		table2 = document.getElementById("during")
		
		tablesocial = document.getElementById("queue_social")
		tablesocial2 = document.getElementById("during_social")

        json.queue.forEach((v) => {
            row = table.insertRow()
            row.insertCell().innerHTML = v.id
            row.insertCell().innerHTML = v.rss != "__custom__" ? v.rss : v.title
            row.insertCell().innerHTML = v.email
            row.insertCell().innerHTML = createForm(v)
        })

        json.during.forEach((v) => {
            row = table2.insertRow()
            row.insertCell().innerHTML = v.id
            row.insertCell().innerHTML = v.rss != "__custom__" ? v.rss : v.title
            row.insertCell().innerHTML = v.email
		})
		
		json.queue_social.forEach((s) => {
            row = tablesocial.insertRow()
            row.insertCell().innerHTML = s.id
            row.insertCell().innerHTML = s.rss != "__custom__" ? s.rss : s.title
            row.insertCell().innerHTML = s.email
            row.insertCell().innerHTML = createFormSocial(s)
        })

        json.during_social.forEach((s) => {
            row = tablesocial2.insertRow()
            row.insertCell().innerHTML = s.id
            row.insertCell().innerHTML = s.rss != "__custom__" ? s.rss : s.title
            row.insertCell().innerHTML = s.email
        })
    })

function submitPrio(id) {
    document.getElementById("prio_" + id).submit()
}

function submitPrioSocial(id) {
    document.getElementById("prio_social_" + id).submit()
}

function submitForm() {
    if (confirm("Valider ces informations?")) {
        document.getElementById("form_option").submit()
    }
}

function createForm(v) {
    return `
        <form id="prio_${v.id}" action="/admin/prio/${v.id}" method="post">
            <select name="priority" id="priority-select" onchange="submitPrio(${v.id})">
                <option ${v.priority == 0 ? "selected" : ""} value="0">Normale</option>
                <option ${v.priority == -1 ? "selected" : ""} value="-1">Basse</option>
                <option ${v.priority == 1 ? "selected" : ""} value="1">Elevée</option>
            </select>
        </form>
    `
}

function createFormSocial(s) {
    return `
        <form id="prio_social_${s.id}" action="/admin/prio/social/${s.id}" method="post">
            <select name="priority" id="priority-select" onchange="submitPrioSocial(${s.id})">
                <option ${s.priority == 0 ? "selected" : ""} value="0">Normale</option>
                <option ${s.priority == -1 ? "selected" : ""} value="-1">Basse</option>
                <option ${s.priority == 1 ? "selected" : ""} value="1">Elevée</option>
            </select>
        </form>
    `
}

//Affichage choix email
document.getElementById("MAIL_SERVICE").addEventListener("change", updateEmail)

function updateEmail() {
    if (document.getElementById("MAIL_SERVICE").value == "gmail") {
        document.getElementById("gmail_group").style.display = "block";
        document.getElementById("smtp_group").style.display = "none";
    } else {
        document.getElementById("gmail_group").style.display = "none";
        document.getElementById("smtp_group").style.display = "block";
    }
}

updateEmail()