// Curated, hand-written recipe dataset. Not AI generated.
const r = (id, title, cuisine, tags, cookTimeMinutes, servings, ingredients, instructions) =>
  ({ id, title, cuisine, tags, cookTimeMinutes, servings, ingredients: ingredients.map(([name, quantity, unit]) => ({ name, quantity, unit })), instructions });

export const RECIPES = [
  r('spinach-cheese-omelette', 'Spinach & Cheese Omelette', 'French', ['vegetarian'], 15, 2,
    [['eggs', 4, 'pcs'], ['spinach', 100, 'g'], ['cheddar cheese', 50, 'g'], ['butter', 10, 'g']],
    ['Whisk the eggs with a pinch of salt.', 'Melt butter in a pan over medium heat and wilt the spinach for 1 minute.', 'Pour in the eggs and cook until the edges set.', 'Add grated cheese, fold, and cook 1 more minute.']),
  r('chicken-pepper-rice', 'Chicken & Pepper Rice Bowl', 'Asian', [], 30, 2,
    [['chicken breast', 400, 'g'], ['rice', 200, 'g'], ['bell pepper', 1, 'pcs'], ['onion', 1, 'pcs'], ['garlic', 2, 'pcs'], ['olive oil', 30, 'ml']],
    ['Cook the rice according to the packet.', 'Slice chicken, pepper and onion; mince garlic.', 'Sear the chicken in oil until golden, 6-8 minutes.', 'Add vegetables and garlic, cook 5 minutes.', 'Serve over rice.']),
  r('creamy-tomato-pasta', 'Creamy Tomato Pasta', 'Italian', ['vegetarian'], 25, 2,
    [['pasta', 250, 'g'], ['tomato', 4, 'pcs'], ['milk', 100, 'ml'], ['garlic', 2, 'pcs'], ['cheddar cheese', 40, 'g'], ['olive oil', 15, 'ml']],
    ['Boil the pasta until al dente.', 'Sauté garlic in oil, add chopped tomatoes and simmer 10 minutes.', 'Stir in the milk and grated cheese until smooth.', 'Toss with the drained pasta.']),
  r('lentil-vegetable-soup', 'Lentil & Vegetable Soup', 'Mediterranean', ['vegetarian', 'vegan'], 40, 4,
    [['lentils', 200, 'g'], ['carrot', 2, 'pcs'], ['onion', 1, 'pcs'], ['tomato', 2, 'pcs'], ['garlic', 3, 'pcs'], ['olive oil', 30, 'ml']],
    ['Soften chopped onion, carrot and garlic in oil for 5 minutes.', 'Add tomatoes, rinsed lentils and 1 litre of water.', 'Simmer 25-30 minutes until lentils are tender.', 'Season and serve.']),
  r('banana-oat-pancakes', 'Banana Oat Pancakes', 'American', ['vegetarian'], 20, 2,
    [['banana', 2, 'pcs'], ['oats', 100, 'g'], ['eggs', 2, 'pcs'], ['milk', 150, 'ml']],
    ['Blend banana, oats, eggs and milk into a batter.', 'Rest for 5 minutes.', 'Cook spoonfuls in a lightly oiled pan, 2 minutes per side.']),
  r('french-toast', 'Classic French Toast', 'French', ['vegetarian'], 15, 2,
    [['bread', 6, 'pcs'], ['eggs', 3, 'pcs'], ['milk', 200, 'ml'], ['butter', 20, 'g']],
    ['Whisk eggs and milk in a shallow dish.', 'Soak each bread slice for 20 seconds per side.', 'Fry in butter until golden on both sides.']),
  r('potato-onion-frittata', 'Potato & Onion Frittata', 'Italian', ['vegetarian'], 35, 4,
    [['potato', 300, 'g'], ['onion', 1, 'pcs'], ['eggs', 6, 'pcs'], ['cheddar cheese', 60, 'g'], ['olive oil', 15, 'ml']],
    ['Thinly slice potatoes and onion and cook in oil until soft, 12 minutes.', 'Beat the eggs and pour over the vegetables.', 'Top with cheese and cook covered on low heat 10 minutes, or finish under a grill.']),
  r('veggie-rice-stir-fry', 'Veggie Rice Stir-fry', 'Asian', ['vegetarian', 'vegan'], 20, 2,
    [['rice', 200, 'g'], ['bell pepper', 1, 'pcs'], ['carrot', 1, 'pcs'], ['spinach', 100, 'g'], ['garlic', 2, 'pcs'], ['olive oil', 15, 'ml']],
    ['Cook and cool the rice.', 'Stir-fry carrot, pepper and garlic in hot oil for 4 minutes.', 'Add rice and spinach and toss 3 minutes.', 'Season and serve.'])
];
export const getRecipe = (id) => RECIPES.find((x) => x.id === id) || null;
