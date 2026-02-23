(function(){
	'use strict';

	// Helpers
	function qs(id){ return document.getElementById(id); }
	function fmt(n){ return Math.round(n); }

	// BMR using Mifflin-St Jeor
	function calcBMR(weightKg, heightCm, ageYears, gender){
		const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
		if(gender === 'male') return base + 5;
		if(gender === 'female') return base - 161;
		// other: average of male and female offsets
		return base + (5 - 161) / 2; // base -78
	}

	function loadLast(){
		try{
			const raw = localStorage.getItem('fp-last');
			if(!raw) return;
			const data = JSON.parse(raw);
			if(data.weight) qs('weight').value = data.weight;
			if(data.height) qs('height').value = data.height;
			if(data.age) qs('age').value = data.age;
			if(data.gender) qs('gender').value = data.gender;
			if(data.activity) qs('activity').value = data.activity;
		}catch(e){}
	}

	function saveLast(obj){
		try{ localStorage.setItem('fp-last', JSON.stringify(obj)); }catch(e){}
	}

	function showResults(bmr, tdee, activity){
		qs('bmrCard').textContent = fmt(bmr) + ' kcal/day';
		qs('tdeeCard').textContent = fmt(tdee) + ' kcal/day';
		qs('tdeeBreakdown').textContent = `TDEE = BMR × ${activity} (activity multiplier)`;
	}

	function clearResults(){
		qs('bmrCard').textContent = '— kcal/day';
		qs('tdeeCard').textContent = '— kcal/day';
		qs('tdeeBreakdown').textContent = 'Activity multiplier applied';
		qs('tdeeRatio').textContent = '—';
		updateDonut(0);
		if(qs('breakfastCard')) qs('breakfastCard').textContent = 'Breakfast';
		if(qs('lunchCard')) qs('lunchCard').textContent = 'Lunch';
		if(qs('dinnerCard')) qs('dinnerCard').textContent = 'Dinner';
	}

	// Main
	document.addEventListener('DOMContentLoaded', function(){

		// Animate on intersection
		const io = new IntersectionObserver((entries)=>{
			entries.forEach(e=>{
				if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
			});
		},{threshold:0.12});
		document.querySelectorAll('[data-anim]').forEach(el=>io.observe(el));

		// Quote of the day
		const quotes = [
			"Small steps every day lead to big changes.",
			"Progress, not perfection.",
			"Strength grows in the moments you think you can't go on.",
			"Consistency beats intensity.",
			"Earned not given."
		];
		function quoteOfDay(){
			const d = new Date();
			const idx = (d.getFullYear()+d.getMonth()+d.getDate()) % quotes.length;
			return quotes[idx];
		}
		if(qs('quoteOfDay')) qs('quoteOfDay').textContent = quoteOfDay();
		if(qs('quoteLarge')) qs('quoteLarge').textContent = '“'+quoteOfDay()+'”';

		// Water tracker init
		const waterEls = Array.from(document.querySelectorAll('.water-glass'));
		let waterCount = parseInt(localStorage.getItem('fp-water') || '0',10) || 0;
		function renderWater(){
			waterEls.forEach((el,i)=>{
				if(i < waterCount) el.classList.add('filled'); else el.classList.remove('filled');
			});
			qs('waterCount').textContent = waterCount;
		}
		waterEls.forEach(el=>{
			el.addEventListener('click', ()=>{
				const i = parseInt(el.getAttribute('data-i'),10) || 0;
				// clicking sets count to that many; clicking same again decreases
				if(waterCount === i) waterCount = i-1; else waterCount = i;
				waterCount = Math.max(0, Math.min(8, waterCount));
				localStorage.setItem('fp-water', String(waterCount));
				renderWater();
			});
		});
		qs('waterReset').addEventListener('click', ()=>{ waterCount = 0; localStorage.setItem('fp-water','0'); renderWater(); });
		renderWater();

		// donut helpers
		const donutFG = document.querySelector('.donut-fg');
		function updateDonut(percent){
			// percent = number like 155 for 155%
			const pct = Math.max(0, Math.min(200, percent)); // cap at 200
			const ratio = pct / 100; // map to 0..2
			const circumference = 2 * Math.PI * 15.9;
			const filled = Math.min(1, ratio/2) * circumference; // scale so 200% -> 100%
			const offset = circumference - filled;
			if(donutFG) donutFG.style.strokeDasharray = `${circumference}`;
			if(donutFG) donutFG.style.strokeDashoffset = offset;
			if(qs('tdeePct')) qs('tdeePct').textContent = (percent>0? Math.round(percent) + '%':'—%');
		}

		const form = qs('fitnessForm');
		const btn = qs('calculateBtn');
		const reset = qs('resetBtn');
		const printBtn = qs('printBtn');
		const workoutSelect = qs('workoutPlan');
		const workoutDetails = qs('workoutDetails');
		const mealProfileSel = qs('mealProfile');

		// Load saved values if any
		loadLast();

		form.addEventListener('submit', function(e){
			e.preventDefault();
			doCalc();
		});

		btn.addEventListener('click', doCalc);
		if(printBtn) printBtn.addEventListener('click', ()=>{ setTimeout(()=>window.print(), 60); });

		// Workout plan rendering
		function renderWorkoutDetails(key){
			if(!workoutDetails) return;
			if(key === 'ppl'){
				workoutDetails.innerHTML = `
					<div class="text-slate-200">
						<div class=\"font-semibold\">Push / Pull / Legs (PPL)</div>
						<ul class=\"mt-2 list-disc pl-5 text-sm\">\
						<li><strong>Push:</strong> Bench, Overhead Press, Triceps</li>\
						<li><strong>Pull:</strong> Deadlift/Rows, Pull-ups, Biceps</li>\
						<li><strong>Legs:</strong> Squats, Lunges, Hamstrings</li>\
						</ul>
					</div>`;
			} else if(key === 'full'){
				workoutDetails.innerHTML = `
					<div class="text-slate-200">
						<div class=\"font-semibold\">Full Body</div>
						<ul class=\"mt-2 list-disc pl-5 text-sm\">\
						<li><strong>Workout A:</strong> Squat, Bench, Row</li>\
						<li><strong>Workout B:</strong> Deadlift, Overhead Press, Pull-ups</li>\
						<li><strong>Workout C:</strong> Front Squat, Incline Press, Romanian Deadlift</li>\
						</ul>
					</div>`;
			} else if(key === 'arnold'){
				workoutDetails.innerHTML = `
					<div class="text-slate-200">
						<div class=\"font-semibold\">Arnold Split (6-Day)</div>
						<div class=\"mt-2 overflow-auto text-sm\">
						<table class=\"w-full table-auto text-sm\"><thead><tr class=\"text-amber-300\"><th class=\"px-2 py-1\">Day</th><th class=\"px-2 py-1\">Focus</th><th class=\"px-2 py-1\">Example Exercises</th></tr></thead><tbody class=\"text-slate-200\">\
						<tr><td class=\"px-2 py-1\">Day 1</td><td class=\"px-2 py-1\">Chest & Back</td><td class=\"px-2 py-1\">Bench Press, Incline DB Press, Barbell Row, Pull-ups</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 2</td><td class=\"px-2 py-1\">Shoulders & Arms</td><td class=\"px-2 py-1\">Overhead Press, Lateral Raises, Curls, Tricep Extensions</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 3</td><td class=\"px-2 py-1\">Legs</td><td class=\"px-2 py-1\">Squats, Romanian Deadlift, Leg Press, Calf Raises</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 4</td><td class=\"px-2 py-1\">Chest & Back</td><td class=\"px-2 py-1\">Incline Bench, Chest Fly, T-Bar Row, Lat Pulldown</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 5</td><td class=\"px-2 py-1\">Shoulders & Arms</td><td class=\"px-2 py-1\">Arnold Press, Rear Delt Fly, Hammer Curls, Skull Crushers</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 6</td><td class=\"px-2 py-1\">Legs</td><td class=\"px-2 py-1\">Front Squat, Lunges, Leg Curl, Glute Bridges</td></tr>\
						<tr><td class=\"px-2 py-1\">Day 7</td><td class=\"px-2 py-1\">Rest</td><td class=\"px-2 py-1\">Active recovery / mobility</td></tr>\
						</tbody></table>
						</div>
					</div>`;
			} else {
				workoutDetails.innerHTML = '';
			}
		}

		if(workoutSelect){
			workoutSelect.addEventListener('change',(e)=>renderWorkoutDetails(e.target.value));
			// render initial
			renderWorkoutDetails(workoutSelect.value);
		}

		// Auto-update meals/target when meal profile or goal changes if we've already calculated
		if(mealProfileSel){
			mealProfileSel.addEventListener('change', ()=>{ if(qs('targetCard')) doCalc(); });
		}
		if(qs('goal')){
			qs('goal').addEventListener('change', ()=>{ if(qs('targetCard')) doCalc(); });
		}

		// Meal templates by profile and goal
		const mealTemplates = {
			lean: {
				lose: {
					breakfast: 'Oats with berries and skim yogurt',
					lunch: 'Grilled chicken salad with mixed greens',
					dinner: 'White fish with steamed vegetables'
				},
				maintain: {
					breakfast: 'Greek yogurt, oats, fruit',
					lunch: 'Turkey breast, quinoa, greens',
					dinner: 'Grilled salmon, veg, small sweet potato'
				},
				gain: {
					breakfast: 'Oats, whey, banana and peanut butter',
					lunch: 'Grilled chicken, rice, avocado',
					dinner: 'Steak, sweet potato, veggies'
				}
			},
			highcarb: {
				lose: {
					breakfast: 'Protein pancake with berries',
					lunch: 'Chicken, large salad, small rice portion',
					dinner: 'White fish and steamed veg'
				},
				maintain: {
					breakfast: 'Eggs, toast, fruit',
					lunch: 'Pasta salad with chicken',
					dinner: 'Salmon with quinoa and veg'
				},
				gain: {
					breakfast: 'Large oats, eggs, juice',
					lunch: 'Steak & pasta',
					dinner: 'Chicken, rice, beans, avocado'
				}
			},
			keto: {
				lose: {
					breakfast: 'Egg omelette with spinach',
					lunch: 'Grilled salmon salad with olive oil',
					dinner: 'White fish with buttered greens'
				},
				maintain: {
					breakfast: 'Eggs, avocado',
					lunch: 'Beef salad with olive oil',
					dinner: 'Pork chop, cauliflower mash'
				},
				gain: {
					breakfast: 'Eggs, bacon, avocado',
					lunch: 'Steak with creamy sauce',
					dinner: 'Fatty fish, buttered veg, nuts'
				}
			}
		};


		reset.addEventListener('click', function(){
			clearResults();
			try{ localStorage.removeItem('fp-last'); }catch(e){}
		});

		function doCalc(){
			const w = parseFloat(qs('weight').value);
			const h = parseFloat(qs('height').value);
			const a = parseFloat(qs('age').value);
			const g = (qs('gender').value || 'male');
			const activity = parseFloat(qs('activity').value) || 1.2;

			if(!w || !h || !a || a < 0 || w <= 0 || h <= 0){
				alert('Please enter valid weight, height and age values.');
				return;
			}

			const bmr = calcBMR(w, h, a, g);
			const tdee = bmr * activity;

			// Goal adjustments
			const goal = (qs('goal') && qs('goal').value) || 'maintain';
			let target = tdee;
			if(goal === 'lose') target = Math.max(0, tdee - 500);
			if(goal === 'gain') target = tdee + 500;

			showResults(bmr, tdee, activity);
			// display target calories
			if(!qs('targetCard')){
				// create a small target element near bmr/tdee if absent
				const targetEl = document.createElement('div');
				targetEl.id = 'targetCard';
				targetEl.className = 'mt-2 text-sm text-amber-300 font-semibold';
				targetEl.textContent = `Target: ${Math.round(target)} kcal/day`;
				qs('tdeeCard').parentNode.appendChild(targetEl);
			} else {
				qs('targetCard').textContent = `Target: ${Math.round(target)} kcal/day`;
			}

			// Update ratio and donut
			const ratio = (tdee / bmr) * 100; // e.g., 155
			qs('tdeeRatio').textContent = Math.round(ratio) + '%';
			updateDonut(ratio);

			// Generate meal suggestions based on selected meal profile & goal
			const profile = (mealProfileSel && mealProfileSel.value) || 'lean';
			const profileKey = profile === 'highcarb' ? 'highcarb' : (profile === 'keto' ? 'keto' : 'lean');
			const templateGroup = mealTemplates[profileKey] || mealTemplates.lean;
			const chosen = templateGroup[goal] || templateGroup.maintain;
			const breakfastCal = Math.round(target * 0.25);
			const lunchCal = Math.round(target * 0.35);
			const dinnerCal = Math.round(target * 0.35);
			if(qs('breakfastCard')) qs('breakfastCard').innerHTML = `<div class="font-semibold">Breakfast — ~${breakfastCal} kcal</div><div class="text-sm text-slate-300 mt-1">${chosen.breakfast}</div>`;
			if(qs('lunchCard')) qs('lunchCard').innerHTML = `<div class="font-semibold">Lunch — ~${lunchCal} kcal</div><div class="text-sm text-slate-300 mt-1">${chosen.lunch}</div>`;
			if(qs('dinnerCard')) qs('dinnerCard').innerHTML = `<div class="font-semibold">Dinner — ~${dinnerCal} kcal</div><div class="text-sm text-slate-300 mt-1">${chosen.dinner}</div>`;

			saveLast({ weight: qs('weight').value, height: qs('height').value, age: qs('age').value, gender: qs('gender').value, activity: qs('activity').value });
		}
	});
})();

