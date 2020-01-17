var noUiSlider = window.noUiSlider;

var slider = document.getElementById('slider');
var mini_slider = document.getElementById("mini_slider")
selectEp = document.getElementById("selectEp")
selectEp.addEventListener("change", changeSelect)
audioPreview = document.getElementById("audioPreview")
audioSelect = document.getElementById("audioSelect")
audioPreview.addEventListener("loadedmetadata", initSlider)
data = {}

document.getElementById("timestart").addEventListener("change", updateStart)
document.getElementById("duration").addEventListener("change", updateDuration)

var interval_check;

hms_format = {
	// 'to' the formatted value. Receives a number.
	to: function (value) {
		nbSec = value;
		sortie = {};
		sortie.heure = Math.trunc(nbSec/3600);
		if (sortie.heure < 10) {sortie.heure = "0"+sortie.heure}
	  
		nbSec = nbSec%3600;
		sortie.minute = Math.trunc(nbSec/60);
		if (sortie.minute < 10) {sortie.minute = "0"+sortie.minute}
	  
		nbSec = nbSec%60;
		sortie.seconde = Math.trunc(nbSec);
		if (sortie.seconde < 10) {sortie.seconde = "0"+sortie.seconde}
	  
		return sortie.heure + ":" + sortie.minute + ":" + sortie.seconde
	},
	// 'from' the formatted value.
	// Receives a string, should return a number.
	from: function (value) {
		if (typeof value == "number") {
			return value
		}
		s = value.split(":")

		if (s.length == 1) {
			return s[0]
		} else {
			nb = parseInt(s[0]) * 3600 + parseInt(s[1]) * 60 + parseInt(s[2])
			
			return nb;
		}
	}
}

noUiSlider.create(slider, {
	start: [0, 600],
	connect: true,
	tooltips: true, 
	range: {
		'min': 0,
		'max': 120
	},
	behaviour: "drag-fixed",	
	format: hms_format
});

noUiSlider.create(mini_slider, {
	start: [0, 60],
	connect: true,
	range: {
		'min': 0,
		'max': 120
	},
	behaviour: "drag",	
	limit: 119,
	margin: 10,
	pips: {
        mode: 'range',
        density: 10,
        format: hms_format
    },
	format: hms_format
});

slider.noUiSlider.on("update", updateSlider);
mini_slider.noUiSlider.on("update", updateMiniSlider);

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
			
			document.getElementById("audioSelector").style.display = "block";
			document.getElementById("infoTime").style.display = "none";

			data = json.data
			changeSelect()
        })
}

function changeSelect() {
	i = 0;
	while (data[i].guid != selectEp.value) {
		i++;
	}

	audioPreview.src = data[i].audio
	audioSelect.src = data[i].audio
}

function initSlider() {
    slider.noUiSlider.updateOptions({
        range: {
            'min': 0,
            'max': audioPreview.duration
        }
	});
	
	slider.noUiSlider.reset()
}

function updateSlider(values, handle, unencoded, tap, positions) {
    // values: Current slider values (array);
    // handle: Handle that caused the event (number);
    // unencoded: Slider values without formatting (array);
    // tap: Event was caused by the user tapping the slider (boolean);
	// positions: Left offset of the handles (array);

    mini_slider.noUiSlider.updateOptions({
        range: {
            'min': hms_format.from(values[0]),
            'max': hms_format.from(values[1])
        }
	});
}

function updateMiniSlider(values, handle, unencoded, tap, positions) {
	document.getElementById("timestart").value = values[0]
	document.getElementById("duration").value = hms_format.from(values[1]) - hms_format.from(values[0])
}

function updateStart() {
	val = document.getElementById("timestart").value
	slider.noUiSlider.set(document.getElementById("timestart").value)
	mini_slider.noUiSlider.set([val, hms_format.to(hms_format.from(val) + parseInt(document.getElementById("duration").value))])
}

function updateDuration() {
	dur = parseInt(document.getElementById("duration").value)
	slider.noUiSlider.set(document.getElementById("timestart").value)
	mini_slider.noUiSlider.set([document.getElementById("timestart").value, hms_format.to(hms_format.from(document.getElementById("timestart").value) + dur)])
}

function playSound() {
	btn = document.getElementById("buttonPlay")

	if (btn.innerHTML == "Ecouter l'extrait") {
		audioPreview.currentTime = hms_format.from(mini_slider.noUiSlider.get()[0])
		audioPreview.play()
		interval_check = setInterval(checkFinish, 500);
		btn.innerHTML = "Arrêter l'écoute"
	} else {
		clearInterval(interval_check)
		audioPreview.pause()
		btn.innerHTML = "Ecouter l'extrait"
	}

}

function checkFinish(checkFinish) {
	if (audioPreview.currentTime - hms_format.from(mini_slider.noUiSlider.get()[0]) > document.getElementById("duration").value) {
		clearInterval(interval_check)
		audioPreview.pause()
		btn.innerHTML = "Ecouter l'extrait"
	}
}

function setStart() {
	slider.noUiSlider.set(audioSelect.currentTime - 60)
	mini_slider.noUiSlider.set([audioSelect.currentTime, audioSelect.currentTime + 60])
}