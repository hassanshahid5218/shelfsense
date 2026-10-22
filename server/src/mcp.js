import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ServiceError } from './errors.js';
import { CATEGORIES, UNITS } from './lib/units.js';

const id = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Must be a 24-character hex ID').describe('MongoDB ObjectId as 24 hex characters');
const name = z.string().trim().min(1).max(80);
const qty = z.number().positive().max(100000);
const unit = z.enum(UNITS);
const category = z.enum(CATEGORIES);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const servings = z.number().int().min(1).max(24).optional().describe('Scale recipe to this many servings');

/** Build a fresh McpServer bound to the shared services. */
export function createMcpServer(svc) {
  const server = new McpServer({ name: 'shelfsense', version: '1.0.0' });

  const reg = (toolName, title, description, inputSchema, fn, { readOnly = false, destructive = false } = {}) => {
    server.registerTool(toolName, { title, description, inputSchema, annotations: { readOnlyHint: readOnly, destructiveHint: destructive, idempotentHint: readOnly } }, async (args) => {
      try {
        const data = await fn(args ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
      } catch (e) {
        if (e instanceof ServiceError) return { isError: true, content: [{ type: 'text', text: `${e.code}: ${e.message}` }] };
        console.error(`[tool:${toolName}]`, e);
        return { isError: true, content: [{ type: 'text', text: 'internal_error: the operation failed' }] };
      }
    });
  };

  // Pantry
  reg('list_pantry', 'List pantry', 'List pantry batches with expiry status. Optional search, category, status filter and sorting.',
    { search: z.string().trim().max(80).optional(), category: category.optional(), status: z.enum(['expired', 'expiring-soon', 'fresh']).optional(),
      sortBy: z.enum(['name', 'expiryDate', 'quantity', 'category', 'createdAt']).optional(), sortDir: z.enum(['asc', 'desc']).optional() }, svc.listPantry, { readOnly: true });
  reg('add_pantry_item', 'Add pantry item', 'Add an ingredient. Same name/unit/expiry merges into one batch; a different expiry creates a separate batch.',
    { name, category, quantity: qty, unit, expiryDate: date.describe('Expiry date, YYYY-MM-DD') }, svc.addPantryItem);
  reg('update_pantry_item', 'Update pantry item', 'Edit fields of one pantry batch by ID.',
    { id, name: name.optional(), category: category.optional(), quantity: qty.optional(), unit: unit.optional(), expiryDate: date.optional() }, svc.updatePantryItem);
  reg('delete_pantry_item', 'Delete pantry item', 'Permanently delete one pantry batch by ID.', { id }, svc.deletePantryItem, { destructive: true });
  reg('mark_item_used', 'Mark item used', 'Consume a quantity of an ingredient, earliest-expiring batch first. Rejects if insufficient stock or incompatible unit. Never goes negative.',
    { name, quantity: qty, unit }, svc.markItemUsed, { destructive: true });
  reg('get_expiring_items', 'Get expiring items', 'Items expiring within N days (default 3), optionally including already-expired items.',
    { days: z.number().int().min(0).max(30).optional(), includeExpired: z.boolean().optional() }, svc.getExpiringItems, { readOnly: true });
  reg('get_pantry_summary', 'Pantry summary', 'Counts by status/category, expiring and expired lists, and recently added items.', {}, svc.getPantrySummary, { readOnly: true });

  // Recipes
  reg('suggest_recipes', 'Suggest recipes', 'Deterministically rank curated recipes by how well the pantry matches, prioritising ingredients nearing expiry. Honors saved dietary preferences.',
    { focus: z.enum(['all', 'expiring']).optional().describe("'expiring' only returns recipes that use soon-to-expire items"), maxMissing: z.number().int().min(0).max(20).optional(), limit: z.number().int().min(1).max(10).optional(), servings }, svc.suggestRecipes, { readOnly: true });
  reg('get_recipe_details', 'Get recipe details', 'Full recipe with instructions, servings, cook time and available vs missing ingredients.', { recipeId: z.string().trim().min(1).max(80), servings }, svc.getRecipeDetails, { readOnly: true });
  reg('get_missing_ingredients', 'Get missing ingredients', 'Which ingredients (and how much) are missing from the pantry for a recipe.', { recipeId: z.string().trim().min(1).max(80), servings }, svc.getMissingIngredients, { readOnly: true });

  // Shopping
  reg('list_shopping_items', 'List shopping items', 'All shopping-list items with open/completed counts.', {}, svc.listShoppingItems, { readOnly: true });
  reg('add_shopping_item', 'Add shopping item', 'Add an item; an identical open item has its quantity increased instead of duplicated.', { name, quantity: qty.optional(), unit: unit.optional() }, svc.addShoppingItem);
  reg('add_missing_recipe_ingredients', 'Add missing recipe ingredients', 'Add a recipe\'s missing ingredients to the shopping list without duplicates. Idempotent.', { recipeId: z.string().trim().min(1).max(80), servings }, svc.addMissingRecipeIngredients);
  reg('toggle_shopping_item', 'Toggle shopping item', 'Flip an item between open and completed.', { id }, svc.toggleShoppingItem);
  reg('remove_shopping_item', 'Remove shopping item', 'Delete one shopping item by ID.', { id }, svc.removeShoppingItem, { destructive: true });
  reg('clear_completed_shopping_items', 'Clear completed items', 'Delete all completed shopping items.', {}, svc.clearCompletedShoppingItems, { destructive: true });

  // Extras (used by the Settings page)
  reg('get_preferences', 'Get preferences', 'Dietary restrictions, preferred cuisine and default servings.', {}, svc.getPreferences, { readOnly: true });
  reg('update_preferences', 'Update preferences', 'Save dietary restrictions, preferred cuisine and default servings.',
    { dietary: z.array(z.enum(['vegetarian', 'vegan'])).max(2).optional(), cuisine: z.string().trim().max(40).optional(), servings: z.number().int().min(1).max(24).optional() },
    async (a) => svc.updatePreferences(a));

  return server;
}
export const TOOL_NAMES = ['list_pantry', 'add_pantry_item', 'update_pantry_item', 'delete_pantry_item', 'mark_item_used', 'get_expiring_items', 'get_pantry_summary', 'suggest_recipes', 'get_recipe_details', 'get_missing_ingredients', 'list_shopping_items', 'add_shopping_item', 'add_missing_recipe_ingredients', 'toggle_shopping_item', 'remove_shopping_item', 'clear_completed_shopping_items'];
