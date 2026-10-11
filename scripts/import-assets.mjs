// Copies the CraftPix sprites the game uses from assets-src/ (git-ignored source packs)
// into public/sprites/ with short names. Run: node scripts/import-assets.mjs
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SRC = 'assets-src/craftpix'
const OUT = 'public/sprites'
const farm = 'free-pixel-art-plants-for-farm/PNG'
const home = 'main-characters-home-free-top-down-pixel-art-asset/PNG'
const girl = 'free-base-4-direction-female-character-pixel-art/PNG/Unarmed'
const animals = 'free-top-down-animals-farm-pixel-art-sprites/PNG/With_shadow'
const hunt = 'free-top-down-hunt-animals-pixel-sprite-pack/PNG/With_Shadow'
const forest = 'free-forest-objects-top-down-pixel-art/PNG/Assets'
const rocks = 'free-rocks-and-stones-top-down-pixel-art/PNG/Objects_separately'

const FILES = {
  'plants.png': `${farm}/Plants.png`,
  'exterior.png': `${home}/exterior.png`,
  'trees.png': `${home}/Trees_animation.png`,
  'cat.png': `${home}/cat_animation.png`,
  'grass_details.png': `${home}/ground_grass_details.png`,
  'girl_walk_body.png': `${girl}/Parts/Unarmed_Walk2_body.png`,
  'girl_walk_head.png': `${girl}/Parts/Unarmed_Walk3_head.png`,
  'girl_idle_body.png': `${girl}/Parts/Unarmed_Idle2_body.png`,
  'girl_idle_head.png': `${girl}/Parts/Unarmed_Idle3_head.png`,
  'girl_shadow.png': `${girl}/Without_shadow/shadow_single.png`,
  'chick.png': `${animals}/Chick_animation_with_shadow.png`,
  'piglet.png': `${animals}/Piglet_animation_with_shadow.png`,
  'lamb.png': `${animals}/Lamb_animation_with_shadow.png`,
  'sheep.png': `${animals}/Sheep_animation_with_shadow.png`,
  'rooster.png': `${animals}/Rooster_animation_with_shadow.png`,
  'calf.png': `${animals}/Calf_animation_with_shadow.png`,
  'fox_walk.png': `${hunt}/Fox/Fox_walk_with_shadow.png`,
  'fox_idle.png': `${hunt}/Fox/Fox_Idle_with_shadow.png`,
  'hare_walk.png': `${hunt}/Hare/Hare_Walk_with_shadow.png`,
  'hare_idle.png': `${hunt}/Hare/Hare_Idle_with_shadow.png`,
  'deer_walk.png': `${hunt}/Deer/Deer_Walk_with_shadow.png`,
  'deer_idle.png': `${hunt}/Deer/Deer_Idle_with_shadow.png`,
  'boar_idle.png': `${hunt}/Boar/Boar_Idle_with_shadow.png`,
  'boar_death.png': `${hunt}/Boar/Boar_Death_with_shadow.png`,
  'fox_death.png': `${hunt}/Fox/Fox_Death_with_shadow.png`,
  'deer_death.png': `${hunt}/Deer/Deer_Death_with_shadow.png`,
  'hare_death.png': `${hunt}/Hare/Hare_Death_with_shadow.png`,
  'grouse_idle.png': `${hunt}/Black_grouse/Black_grouse_Idle_with_shadow.png`,
  'grouse_death.png': `${hunt}/Black_grouse/Black_grouse_Death_with_shadow.png`,
  'f_luminous.png': `${forest}/Luminous_tree2.png`,
  'f_lightballs.png': `${forest}/Light_balls_tree2.png`,
  'f_willow.png': `${forest}/Willow2.png`,
  'f_swirl.png': `${forest}/Swirling tree2.png`,
  'f_white.png': `${forest}/White_tree2.png`,
  'f_bluegreen.png': `${forest}/Blue-green_balls_tree2.png`,
  'f_idol_deer.png': `${forest}/Tree_idol_deer.png`,
  'f_idol_wolf.png': `${forest}/Tree_idol_wolf.png`,
  'f_gazebo.png': `${forest}/Living gazebo2.png`,
  'f_ent.png': `${forest}/Ent_woman.png`,
  'f_chanterelles.png': `${forest}/Chanterelles1.png`,
  'f_beige_mushroom.png': `${forest}/Beige_green_mushroom1.png`,
  'r_frost.png': `${rocks}/Rock3_1.png`,
  'r_frost_small.png': `${rocks}/Rock3_4.png`,
  'r_ember.png': `${rocks}/Rock8_2.png`,
  'r_mossy.png': `${rocks}/Rock4_2.png`,
  'r_quartz.png': `${rocks}/Rock5_2.png`,
}

mkdirSync(OUT, { recursive: true })
let missing = 0
for (const [dest, src] of Object.entries(FILES)) {
  const from = join(SRC, src)
  if (!existsSync(from)) {
    console.warn('missing', from)
    missing++
    continue
  }
  copyFileSync(from, join(OUT, dest))
}
console.log(`copied ${Object.keys(FILES).length - missing} sprites to ${OUT}`)
