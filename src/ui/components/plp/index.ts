export { CategoryHero } from "./category-hero";
export { PageHeader } from "./page-header";
export { ProductCard, type ProductCardData } from "./product-card";
export { ProductGrid } from "./product-grid";
export {
	FilterBar,
	type SortOption,
	type FilterOption,
	type CategoryFilterOption,
	type ActiveFilter,
} from "./filter-bar";
export { WavePattern } from "./wave-pattern";
export { transformToProductCard, formatPrice } from "./utils";
export {
	// Server-side filter helpers (resolveCategorySlugsToIds is in filter-utils.server.ts)
	buildFilterVariables,
	buildSortVariables,
	// Client-side filter helpers
	extractCategoryOptions,
	extractColorOptions,
	extractSizeOptions,
	filterProducts,
	sortProductsClientSide,
	buildActiveFilters,
	// Price ranges (currency-aware, used for server-side price filtering)
	getPriceRanges,
	// Types
	type CategoryOption,
	type PriceRange,
} from "./filter-utils";
export { useProductFilters } from "./use-product-filters";
