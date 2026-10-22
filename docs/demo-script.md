# Demo script (under 3 minutes)

**Prep (once):** `npm run seed`, `npm run dev`, open http://localhost:5173, enter the demo access code.
Re-seeding is a no-op, so on later days add a couple of items expiring in 1-2 days from My Pantry first.

1. **Dashboard (0:00-0:30).** Point out the live stats: items expiring in 3 days, expired items (banana, lettuce), and the freshness chart. "All of this is read from MongoDB through MCP `get_pantry_summary`."
2. **Assistant (0:30-1:15).** Click *What can I cook using ingredients that will expire soon?* Show the green tool chips (`suggest_recipes`) and the ranked meals that name the expiring ingredients (e.g. spinach, chicken, bread).
3. **Select a meal (1:15-1:45).** Click **Select** on a recipe with missing items. The assistant calls `get_missing_ingredients` and lists exactly what is missing.
4. **Confirm (1:45-2:10).** Click **Add N to shopping list**. A real `add_missing_recipe_ingredients` call runs; the reply confirms only after it succeeds. Click it again via the typed command *Add missing ingredients to my shopping list* to show nothing is duplicated.
5. **Log usage (2:10-2:25).** Type *I used one liter of milk*; the reply shows what remains (earliest-expiring batch used first).
6. **Persistence (2:25-3:00).** Open *Shopping List*, then reload the browser (re-enter the code). The items are still there because they live in MongoDB.
