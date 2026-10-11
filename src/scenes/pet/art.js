export const petStyles={
  happy:{animal:'penguin',name:'企鹅'},
  quiet:{animal:'whale',name:'鲸鱼'},
  silly:{animal:'dachshund',name:'腊肠犬'}
};
export function petArt(personality='happy'){
  const pet=petStyles[personality]||petStyles.happy;
  return `<img class="pet-svg plush-pet" src="/assets/pets/${pet.animal}.png" alt="毛绒${pet.name}宠物" width="768" height="768" draggable="false"><span class="pet-turn" aria-hidden="true" style="background-image:url(/assets/pets/${pet.animal}-turn.png)"></span>`;
}
