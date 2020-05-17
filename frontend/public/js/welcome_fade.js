// Attribution:
// Anthony Laurence Yap
// https://www.altometa.com/fade-in-and-fade-out-effect-javascript-function/

function fadeInEntrance(id,spd){
	var opac = 0;
	id.style.filter = "alpha(opacity=" + 0 + ")";
	if(id.style.opacity <= 1){
		var cycle = setInterval(increaseOpacity,spd);
		function increaseOpacity() {
			opac += 0.01;
			if(opac >= 1){
				id.style.opacity = 1;
				opac = 1;
				clearInterval(cycle);
			}
			id.style.opacity = opac;
			id.style.filter = "alpha(opacity=" + (opac * 100) + ")";
		}
	} else {
		clearInterval(cycle);
	}
}
