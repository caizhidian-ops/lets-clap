// Shared timing/geometry contract: inputs, feet clearance and rope crossings agree.
export function ropeTiming(bpm){const period=60/bpm;return {period,crossingDelay:period*.36,jumpDuration:Math.min(.65,period*.78),window:Math.min(.18,period*.27)};}
export function jumpHeight(age,bpm){const {jumpDuration}=ropeTiming(bpm);return age>=0&&age<=jumpDuration?Math.sin(Math.PI*age/jumpDuration)*1.65:0;}
export function ropeAngleAt(elapsed,bpm){const {period,crossingDelay}=ropeTiming(bpm);return 2*Math.PI*(elapsed-crossingDelay)/period;}
export function ropePoint(u,angle){return [-3.65*Math.cos(u),2.05-1.89*Math.sin(u)*Math.cos(angle),.7+1.89*Math.sin(u)*Math.sin(angle)];}
