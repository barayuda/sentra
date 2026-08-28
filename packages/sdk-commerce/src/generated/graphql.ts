/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { DocumentTypeDecoration } from '@graphql-typed-document-node/core';
/**
 * A custom key-value pair that stores additional information on a [cart](https://shopify.dev/docs/api/storefront/current/objects/Cart) or [cart line](https://shopify.dev/docs/api/storefront/current/objects/CartLine). Attributes capture additional information like gift messages, special instructions, or custom order details. Learn more about [managing carts with the Storefront API](https://shopify.dev/docs/storefronts/headless/building-with-the-storefront-api/cart/manage).
 *
 */
export type AttributeInput = {
  /** Key or name of the attribute. */
  key: string;
  /** Value of the attribute. */
  value: string;
};

/**
 * Error codes returned by [`CartUserError`](https://shopify.dev/docs/api/storefront/current/objects/CartUserError) during cart mutations. Covers validation failures for addresses, quantities, delivery options, merchandise lines, discount codes, and metafields.
 *
 */
export type CartErrorCode =
  /** The specified address field contains emojis. */
  | 'ADDRESS_FIELD_CONTAINS_EMOJIS'
  /** The specified address field contains HTML tags. */
  | 'ADDRESS_FIELD_CONTAINS_HTML_TAGS'
  /** The specified address field contains a URL. */
  | 'ADDRESS_FIELD_CONTAINS_URL'
  /** The specified address field does not match the expected pattern. */
  | 'ADDRESS_FIELD_DOES_NOT_MATCH_EXPECTED_PATTERN'
  /** The specified address field is required. */
  | 'ADDRESS_FIELD_IS_REQUIRED'
  /** The specified address field is too long. */
  | 'ADDRESS_FIELD_IS_TOO_LONG'
  /** Bundles and addons cannot be mixed. */
  | 'BUNDLES_AND_ADDONS_CANNOT_BE_MIXED'
  /** Buyer cannot purchase for company location. */
  | 'BUYER_CANNOT_PURCHASE_FOR_COMPANY_LOCATION'
  /** The cart is too large to save. */
  | 'CART_TOO_LARGE'
  /** The specified gift card recipient is invalid. */
  | 'GIFT_CARD_RECIPIENT_INVALID'
  /** The input value is invalid. */
  | 'INVALID'
  /** Company location not found or not allowed. */
  | 'INVALID_COMPANY_LOCATION'
  /** The delivery address was not found. */
  | 'INVALID_DELIVERY_ADDRESS_ID'
  /** Delivery group was not found in cart. */
  | 'INVALID_DELIVERY_GROUP'
  /** Delivery option was not valid. */
  | 'INVALID_DELIVERY_OPTION'
  /** The quantity must be a multiple of the specified increment. */
  | 'INVALID_INCREMENT'
  /** Merchandise line was not found in cart. */
  | 'INVALID_MERCHANDISE_LINE'
  /** The metafields were not valid. */
  | 'INVALID_METAFIELDS'
  /** The payment wasn't valid. */
  | 'INVALID_PAYMENT'
  /** The payment is invalid. Deferred payment is required. */
  | 'INVALID_PAYMENT_DEFERRED_PAYMENT_REQUIRED'
  /** Cannot update payment on an empty cart */
  | 'INVALID_PAYMENT_EMPTY_CART'
  /** The given zip code is invalid for the provided country. */
  | 'INVALID_ZIP_CODE_FOR_COUNTRY'
  /** The given zip code is invalid for the provided province. */
  | 'INVALID_ZIP_CODE_FOR_PROVINCE'
  /** The input value should be less than the maximum value allowed. */
  | 'LESS_THAN'
  /** The quantity must be below the specified maximum for the item. */
  | 'MAXIMUM_EXCEEDED'
  /** An error occurred while processing cart transformations. */
  | 'MERCHANDISE_LINE_TRANSFORMERS_RUN_ERROR'
  /** Item cannot be purchased as configured. */
  | 'MERCHANDISE_NOT_APPLICABLE'
  /** The quantity must be above the specified minimum for the item. */
  | 'MINIMUM_NOT_MET'
  /** The customer access token is required when setting a company location. */
  | 'MISSING_CUSTOMER_ACCESS_TOKEN'
  /** Missing discount code. */
  | 'MISSING_DISCOUNT_CODE'
  /** Missing note. */
  | 'MISSING_NOTE'
  /** The note length must be below the specified maximum. */
  | 'NOTE_TOO_LONG'
  /** Only one delivery address can be selected. */
  | 'ONLY_ONE_DELIVERY_ADDRESS_CAN_BE_SELECTED'
  /** Cannot reference existing parent lines by variant_id. */
  | 'PARENT_LINE_INVALID_REFERENCE'
  /** Parent line nesting is too deep or circular. */
  | 'PARENT_LINE_NESTING_TOO_DEEP'
  /** Parent line not found. */
  | 'PARENT_LINE_NOT_FOUND'
  /** Nested cartlines are blocked due to an incompatibility. */
  | 'PARENT_LINE_OPERATION_BLOCKED'
  /** Credit card has expired. */
  | 'PAYMENTS_CREDIT_CARD_BASE_EXPIRED'
  /** Credit card gateway is not supported. */
  | 'PAYMENTS_CREDIT_CARD_BASE_GATEWAY_NOT_SUPPORTED'
  /** Credit card error. */
  | 'PAYMENTS_CREDIT_CARD_GENERIC'
  /** Credit card month is invalid. */
  | 'PAYMENTS_CREDIT_CARD_MONTH_INCLUSION'
  /** Credit card number is invalid. */
  | 'PAYMENTS_CREDIT_CARD_NUMBER_INVALID'
  /** Credit card number format is invalid. */
  | 'PAYMENTS_CREDIT_CARD_NUMBER_INVALID_FORMAT'
  /** Credit card verification value is blank. */
  | 'PAYMENTS_CREDIT_CARD_VERIFICATION_VALUE_BLANK'
  /** Credit card verification value is invalid for card type. */
  | 'PAYMENTS_CREDIT_CARD_VERIFICATION_VALUE_INVALID_FOR_CARD_TYPE'
  /** Credit card has expired. */
  | 'PAYMENTS_CREDIT_CARD_YEAR_EXPIRED'
  /** Credit card expiry year is invalid. */
  | 'PAYMENTS_CREDIT_CARD_YEAR_INVALID_EXPIRY_YEAR'
  /** The payment method is not applicable. */
  | 'PAYMENT_METHOD_NOT_APPLICABLE'
  /** The payment method is not supported. */
  | 'PAYMENT_METHOD_NOT_SUPPORTED'
  /** The delivery group is in a pending state. */
  | 'PENDING_DELIVERY_GROUPS'
  /** The given province cannot be found. */
  | 'PROVINCE_NOT_FOUND'
  /** Selling plan is not applicable. */
  | 'SELLING_PLAN_NOT_APPLICABLE'
  /** An error occurred while saving the cart. */
  | 'SERVICE_UNAVAILABLE'
  /** Too many delivery addresses on Cart. */
  | 'TOO_MANY_DELIVERY_ADDRESSES'
  /** A general error occurred during address validation. */
  | 'UNSPECIFIED_ADDRESS_ERROR'
  /** Validation failed. */
  | 'VALIDATION_CUSTOM'
  /** Variant can only be purchased with a selling plan. */
  | 'VARIANT_REQUIRES_SELLING_PLAN'
  /** The given zip code is unsupported. */
  | 'ZIP_CODE_NOT_SUPPORTED';

/**
 * The input fields for adding a merchandise line to a cart. Each line represents a [`ProductVariant`](https://shopify.dev/docs/api/storefront/current/objects/ProductVariant) the buyer intends to purchase, along with the quantity and optional [`SellingPlan`](https://shopify.dev/docs/api/storefront/current/objects/SellingPlan) for subscriptions.
 *
 * Used by the [`cartCreate`](https://shopify.dev/docs/api/storefront/current/mutations/cartCreate) mutation when creating a cart with initial items, and the [`cartLinesAdd`](https://shopify.dev/docs/api/storefront/current/mutations/cartLinesAdd) mutation when adding items to an existing cart.
 *
 */
export type CartLineInput = {
  /**
   * An array of key-value pairs that contains additional information about the merchandise line.
   *
   * The input must not contain more than `250` values.
   */
  attributes?: Array<AttributeInput> | null | undefined;
  /** The ID of the merchandise that the buyer intends to purchase. */
  merchandiseId: string | number;
  /** The parent line item of the cart line. */
  parent?: CartLineParentInput | null | undefined;
  /** The quantity of the merchandise. */
  quantity?: number | null | undefined;
  /** The ID of the selling plan that the merchandise is being purchased with. */
  sellingPlanId?: string | number | null | undefined;
};

/** The parent line item of the cart line. */
export type CartLineParentInput = {
  /** The id of the parent line item. */
  lineId?: string | number | null | undefined;
  /** The ID of the parent line merchandise. */
  merchandiseId?: string | number | null | undefined;
};

/**
 * The input fields for updating a merchandise line in a cart. Used by the [`cartLinesUpdate`](https://shopify.dev/docs/api/storefront/current/mutations/cartLinesUpdate) mutation.
 *
 * Specify the line item's [`id`](https://shopify.dev/docs/api/storefront/current/input-objects/CartLineUpdateInput#fields-id) along with any fields to modify. You can change the quantity, swap the merchandise, update custom attributes, or associate a different selling plan.
 *
 */
export type CartLineUpdateInput = {
  /**
   * An array of key-value pairs that contains additional information about the merchandise line.
   *
   * The input must not contain more than `250` values.
   */
  attributes?: Array<AttributeInput> | null | undefined;
  /** The ID of the merchandise line. */
  id: string | number;
  /** The ID of the merchandise for the line item. */
  merchandiseId?: string | number | null | undefined;
  /** The quantity of the line item. */
  quantity?: number | null | undefined;
  /** The ID of the selling plan that the merchandise is being purchased with. */
  sellingPlanId?: string | number | null | undefined;
};

/**
 * The three-letter currency codes that represent the world currencies used in
 * stores. These include standard ISO 4217 codes, legacy codes,
 * and non-standard codes.
 *
 */
export type CurrencyCode =
  /** United Arab Emirates Dirham (AED). */
  | 'AED'
  /** Afghan Afghani (AFN). */
  | 'AFN'
  /** Albanian Lek (ALL). */
  | 'ALL'
  /** Armenian Dram (AMD). */
  | 'AMD'
  /** Netherlands Antillean Guilder. */
  | 'ANG'
  /** Angolan Kwanza (AOA). */
  | 'AOA'
  /** Argentine Pesos (ARS). */
  | 'ARS'
  /** Australian Dollars (AUD). */
  | 'AUD'
  /** Aruban Florin (AWG). */
  | 'AWG'
  /** Azerbaijani Manat (AZN). */
  | 'AZN'
  /** Bosnia and Herzegovina Convertible Mark (BAM). */
  | 'BAM'
  /** Barbadian Dollar (BBD). */
  | 'BBD'
  /** Bangladesh Taka (BDT). */
  | 'BDT'
  /** Bulgarian Lev (BGN). */
  | 'BGN'
  /** Bahraini Dinar (BHD). */
  | 'BHD'
  /** Burundian Franc (BIF). */
  | 'BIF'
  /** Bermudian Dollar (BMD). */
  | 'BMD'
  /** Brunei Dollar (BND). */
  | 'BND'
  /** Bolivian Boliviano (BOB). */
  | 'BOB'
  /** Brazilian Real (BRL). */
  | 'BRL'
  /** Bahamian Dollar (BSD). */
  | 'BSD'
  /** Bhutanese Ngultrum (BTN). */
  | 'BTN'
  /** Botswana Pula (BWP). */
  | 'BWP'
  /** Belarusian Ruble (BYN). */
  | 'BYN'
  /** Belarusian Ruble (BYR). */
  | 'BYR'
  /** Belize Dollar (BZD). */
  | 'BZD'
  /** Canadian Dollars (CAD). */
  | 'CAD'
  /** Congolese franc (CDF). */
  | 'CDF'
  /** Swiss Francs (CHF). */
  | 'CHF'
  /** Chilean Peso (CLP). */
  | 'CLP'
  /** Chinese Yuan Renminbi (CNY). */
  | 'CNY'
  /** Colombian Peso (COP). */
  | 'COP'
  /** Costa Rican Colones (CRC). */
  | 'CRC'
  /** Cape Verdean escudo (CVE). */
  | 'CVE'
  /** Czech Koruny (CZK). */
  | 'CZK'
  /** Djiboutian Franc (DJF). */
  | 'DJF'
  /** Danish Kroner (DKK). */
  | 'DKK'
  /** Dominican Peso (DOP). */
  | 'DOP'
  /** Algerian Dinar (DZD). */
  | 'DZD'
  /** Egyptian Pound (EGP). */
  | 'EGP'
  /** Eritrean Nakfa (ERN). */
  | 'ERN'
  /** Ethiopian Birr (ETB). */
  | 'ETB'
  /** Euro (EUR). */
  | 'EUR'
  /** Fijian Dollars (FJD). */
  | 'FJD'
  /** Falkland Islands Pounds (FKP). */
  | 'FKP'
  /** United Kingdom Pounds (GBP). */
  | 'GBP'
  /** Georgian Lari (GEL). */
  | 'GEL'
  /** Ghanaian Cedi (GHS). */
  | 'GHS'
  /** Gibraltar Pounds (GIP). */
  | 'GIP'
  /** Gambian Dalasi (GMD). */
  | 'GMD'
  /** Guinean Franc (GNF). */
  | 'GNF'
  /** Guatemalan Quetzal (GTQ). */
  | 'GTQ'
  /** Guyanese Dollar (GYD). */
  | 'GYD'
  /** Hong Kong Dollars (HKD). */
  | 'HKD'
  /** Honduran Lempira (HNL). */
  | 'HNL'
  /** Croatian Kuna (HRK). */
  | 'HRK'
  /** Haitian Gourde (HTG). */
  | 'HTG'
  /** Hungarian Forint (HUF). */
  | 'HUF'
  /** Indonesian Rupiah (IDR). */
  | 'IDR'
  /** Israeli New Shekel (NIS). */
  | 'ILS'
  /** Indian Rupees (INR). */
  | 'INR'
  /** Iraqi Dinar (IQD). */
  | 'IQD'
  /** Iranian Rial (IRR). */
  | 'IRR'
  /** Icelandic Kronur (ISK). */
  | 'ISK'
  /** Jersey Pound. */
  | 'JEP'
  /** Jamaican Dollars (JMD). */
  | 'JMD'
  /** Jordanian Dinar (JOD). */
  | 'JOD'
  /** Japanese Yen (JPY). */
  | 'JPY'
  /** Kenyan Shilling (KES). */
  | 'KES'
  /** Kyrgyzstani Som (KGS). */
  | 'KGS'
  /** Cambodian Riel. */
  | 'KHR'
  /** Kiribati Dollar (KID). */
  | 'KID'
  /** Comorian Franc (KMF). */
  | 'KMF'
  /** South Korean Won (KRW). */
  | 'KRW'
  /** Kuwaiti Dinar (KWD). */
  | 'KWD'
  /** Cayman Dollars (KYD). */
  | 'KYD'
  /** Kazakhstani Tenge (KZT). */
  | 'KZT'
  /** Laotian Kip (LAK). */
  | 'LAK'
  /** Lebanese Pounds (LBP). */
  | 'LBP'
  /** Sri Lankan Rupees (LKR). */
  | 'LKR'
  /** Liberian Dollar (LRD). */
  | 'LRD'
  /** Lesotho Loti (LSL). */
  | 'LSL'
  /** Lithuanian Litai (LTL). */
  | 'LTL'
  /** Latvian Lati (LVL). */
  | 'LVL'
  /** Libyan Dinar (LYD). */
  | 'LYD'
  /** Moroccan Dirham. */
  | 'MAD'
  /** Moldovan Leu (MDL). */
  | 'MDL'
  /** Malagasy Ariary (MGA). */
  | 'MGA'
  /** Macedonia Denar (MKD). */
  | 'MKD'
  /** Burmese Kyat (MMK). */
  | 'MMK'
  /** Mongolian Tugrik. */
  | 'MNT'
  /** Macanese Pataca (MOP). */
  | 'MOP'
  /** Mauritanian Ouguiya (MRU). */
  | 'MRU'
  /** Mauritian Rupee (MUR). */
  | 'MUR'
  /** Maldivian Rufiyaa (MVR). */
  | 'MVR'
  /** Malawian Kwacha (MWK). */
  | 'MWK'
  /** Mexican Pesos (MXN). */
  | 'MXN'
  /** Malaysian Ringgits (MYR). */
  | 'MYR'
  /** Mozambican Metical. */
  | 'MZN'
  /** Namibian Dollar. */
  | 'NAD'
  /** Nigerian Naira (NGN). */
  | 'NGN'
  /** Nicaraguan Córdoba (NIO). */
  | 'NIO'
  /** Norwegian Kroner (NOK). */
  | 'NOK'
  /** Nepalese Rupee (NPR). */
  | 'NPR'
  /** New Zealand Dollars (NZD). */
  | 'NZD'
  /** Omani Rial (OMR). */
  | 'OMR'
  /** Panamian Balboa (PAB). */
  | 'PAB'
  /** Peruvian Nuevo Sol (PEN). */
  | 'PEN'
  /** Papua New Guinean Kina (PGK). */
  | 'PGK'
  /** Philippine Peso (PHP). */
  | 'PHP'
  /** Pakistani Rupee (PKR). */
  | 'PKR'
  /** Polish Zlotych (PLN). */
  | 'PLN'
  /** Paraguayan Guarani (PYG). */
  | 'PYG'
  /** Qatari Rial (QAR). */
  | 'QAR'
  /** Romanian Lei (RON). */
  | 'RON'
  /** Serbian dinar (RSD). */
  | 'RSD'
  /** Russian Rubles (RUB). */
  | 'RUB'
  /** Rwandan Franc (RWF). */
  | 'RWF'
  /** Saudi Riyal (SAR). */
  | 'SAR'
  /** Solomon Islands Dollar (SBD). */
  | 'SBD'
  /** Seychellois Rupee (SCR). */
  | 'SCR'
  /** Sudanese Pound (SDG). */
  | 'SDG'
  /** Swedish Kronor (SEK). */
  | 'SEK'
  /** Singapore Dollars (SGD). */
  | 'SGD'
  /** Saint Helena Pounds (SHP). */
  | 'SHP'
  /** Sierra Leonean Leone (SLL). */
  | 'SLL'
  /** Somali Shilling (SOS). */
  | 'SOS'
  /** Surinamese Dollar (SRD). */
  | 'SRD'
  /** South Sudanese Pound (SSP). */
  | 'SSP'
  /** Sao Tome And Principe Dobra (STD). */
  | 'STD'
  /** Sao Tome And Principe Dobra (STN). */
  | 'STN'
  /** Syrian Pound (SYP). */
  | 'SYP'
  /** Swazi Lilangeni (SZL). */
  | 'SZL'
  /** Thai baht (THB). */
  | 'THB'
  /** Tajikistani Somoni (TJS). */
  | 'TJS'
  /** Turkmenistani Manat (TMT). */
  | 'TMT'
  /** Tunisian Dinar (TND). */
  | 'TND'
  /** Tongan Pa'anga (TOP). */
  | 'TOP'
  /** Turkish Lira (TRY). */
  | 'TRY'
  /** Trinidad and Tobago Dollars (TTD). */
  | 'TTD'
  /** Taiwan Dollars (TWD). */
  | 'TWD'
  /** Tanzanian Shilling (TZS). */
  | 'TZS'
  /** Ukrainian Hryvnia (UAH). */
  | 'UAH'
  /** Ugandan Shilling (UGX). */
  | 'UGX'
  /** United States Dollars (USD). */
  | 'USD'
  /** Uruguayan Pesos (UYU). */
  | 'UYU'
  /** Uzbekistan som (UZS). */
  | 'UZS'
  /** Venezuelan Bolivares (VED). */
  | 'VED'
  /** Venezuelan Bolivares (VEF). */
  | 'VEF'
  /** Venezuelan Bolivares Soberanos (VES). */
  | 'VES'
  /** Vietnamese đồng (VND). */
  | 'VND'
  /** Vanuatu Vatu (VUV). */
  | 'VUV'
  /** Samoan Tala (WST). */
  | 'WST'
  /** Central African CFA Franc (XAF). */
  | 'XAF'
  /** East Caribbean Dollar (XCD). */
  | 'XCD'
  /** West African CFA franc (XOF). */
  | 'XOF'
  /** CFP Franc (XPF). */
  | 'XPF'
  /** Unrecognized currency. */
  | 'XXX'
  /** Yemeni Rial (YER). */
  | 'YER'
  /** South African Rand (ZAR). */
  | 'ZAR'
  /** Zambian Kwacha (ZMW). */
  | 'ZMW';

export type ProductSummaryFieldsFragment = { id: string, handle: string, title: string, availableForSale: boolean, featuredImage: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, priceRange: { minVariantPrice: { amount: unknown, currencyCode: CurrencyCode } } };

export type MoneyFieldsFragment = { amount: unknown, currencyCode: CurrencyCode };

export type CartFieldsFragment = { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
        | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
        | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
       }> } };

export type CollectionPageQueryVariables = Exact<{
  handle: string;
  first: number;
  after?: string | null | undefined;
}>;


export type CollectionPageQuery = { collection: { handle: string, title: string, products: { pageInfo: { hasNextPage: boolean, endCursor: string | null }, edges: Array<{ node: { id: string, handle: string, title: string, availableForSale: boolean, featuredImage: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, priceRange: { minVariantPrice: { amount: unknown, currencyCode: CurrencyCode } } } }> } } | null };

export type ProductDetailQueryVariables = Exact<{
  handle: string;
}>;


export type ProductDetailQuery = { product: { descriptionHtml: unknown, id: string, handle: string, title: string, availableForSale: boolean, variants: { edges: Array<{ node: { id: string, title: string, availableForSale: boolean, price: { amount: unknown, currencyCode: CurrencyCode } } }> }, featuredImage: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, priceRange: { minVariantPrice: { amount: unknown, currencyCode: CurrencyCode } } } | null };

export type CartGetQueryVariables = Exact<{
  cartId: string | number;
}>;


export type CartGetQuery = { cart: { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
          | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
          | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
         }> } } | null };

export type CartCreateMutationVariables = Exact<{
  lines?: Array<CartLineInput> | CartLineInput | null | undefined;
}>;


export type CartCreateMutation = { cartCreate: { cart: { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
           }> } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: CartErrorCode | null }> } | null };

export type CartLinesAddMutationVariables = Exact<{
  cartId: string | number;
  lines: Array<CartLineInput> | CartLineInput;
}>;


export type CartLinesAddMutation = { cartLinesAdd: { cart: { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
           }> } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: CartErrorCode | null }> } | null };

export type CartLinesUpdateMutationVariables = Exact<{
  cartId: string | number;
  lines: Array<CartLineUpdateInput> | CartLineUpdateInput;
}>;


export type CartLinesUpdateMutation = { cartLinesUpdate: { cart: { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
           }> } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: CartErrorCode | null }> } | null };

export type CartLinesRemoveMutationVariables = Exact<{
  cartId: string | number;
  lineIds: Array<string | number> | string | number;
}>;


export type CartLinesRemoveMutation = { cartLinesRemove: { cart: { id: string, checkoutUrl: unknown, totalQuantity: number, cost: { subtotalAmount: { amount: unknown, currencyCode: CurrencyCode } }, lines: { edges: Array<{ node:
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
            | { id: string, quantity: number, merchandise: { id: string, title: string, price: { amount: unknown, currencyCode: CurrencyCode }, image: { url: unknown, altText: string | null, width: number | null, height: number | null } | null, product: { title: string, handle: string } } }
           }> } } | null, userErrors: Array<{ field: Array<string> | null, message: string, code: CartErrorCode | null }> } | null };

export class TypedDocumentString<TResult, TVariables>
  extends String
  implements DocumentTypeDecoration<TResult, TVariables>
{
  __apiType?: NonNullable<DocumentTypeDecoration<TResult, TVariables>['__apiType']>;
  private value: string;
  public __meta__?: Record<string, any> | undefined;

  constructor(value: string, __meta__?: Record<string, any> | undefined) {
    super(value);
    this.value = value;
    this.__meta__ = __meta__;
  }

  override toString(): string & DocumentTypeDecoration<TResult, TVariables> {
    return this.value;
  }
}
export const ProductSummaryFieldsFragmentDoc = new TypedDocumentString(`
    fragment ProductSummaryFields on Product {
  id
  handle
  title
  availableForSale
  featuredImage {
    url
    altText
    width
    height
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
}
    `, {"fragmentName":"ProductSummaryFields"}) as unknown as TypedDocumentString<ProductSummaryFieldsFragment, unknown>;
export const MoneyFieldsFragmentDoc = new TypedDocumentString(`
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
    `, {"fragmentName":"MoneyFields"}) as unknown as TypedDocumentString<MoneyFieldsFragment, unknown>;
export const CartFieldsFragmentDoc = new TypedDocumentString(`
    fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}`, {"fragmentName":"CartFields"}) as unknown as TypedDocumentString<CartFieldsFragment, unknown>;
export const CollectionPageDocument = new TypedDocumentString(`
    query CollectionPage($handle: String!, $first: Int!, $after: String) {
  collection(handle: $handle) {
    handle
    title
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          ...ProductSummaryFields
        }
      }
    }
  }
}
    fragment ProductSummaryFields on Product {
  id
  handle
  title
  availableForSale
  featuredImage {
    url
    altText
    width
    height
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
}`) as unknown as TypedDocumentString<CollectionPageQuery, CollectionPageQueryVariables>;
export const ProductDetailDocument = new TypedDocumentString(`
    query ProductDetail($handle: String!) {
  product(handle: $handle) {
    ...ProductSummaryFields
    descriptionHtml
    variants(first: 20) {
      edges {
        node {
          id
          title
          availableForSale
          price {
            ...MoneyFields
          }
        }
      }
    }
  }
}
    fragment ProductSummaryFields on Product {
  id
  handle
  title
  availableForSale
  featuredImage {
    url
    altText
    width
    height
  }
  priceRange {
    minVariantPrice {
      amount
      currencyCode
    }
  }
}
fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}`) as unknown as TypedDocumentString<ProductDetailQuery, ProductDetailQueryVariables>;
export const CartGetDocument = new TypedDocumentString(`
    query CartGet($cartId: ID!) {
  cart(id: $cartId) {
    ...CartFields
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}`) as unknown as TypedDocumentString<CartGetQuery, CartGetQueryVariables>;
export const CartCreateDocument = new TypedDocumentString(`
    mutation CartCreate($lines: [CartLineInput!]) {
  cartCreate(input: {lines: $lines}) {
    cart {
      ...CartFields
    }
    userErrors {
      field
      message
      code
    }
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}`) as unknown as TypedDocumentString<CartCreateMutation, CartCreateMutationVariables>;
export const CartLinesAddDocument = new TypedDocumentString(`
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
  cartLinesAdd(cartId: $cartId, lines: $lines) {
    cart {
      ...CartFields
    }
    userErrors {
      field
      message
      code
    }
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}`) as unknown as TypedDocumentString<CartLinesAddMutation, CartLinesAddMutationVariables>;
export const CartLinesUpdateDocument = new TypedDocumentString(`
    mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
  cartLinesUpdate(cartId: $cartId, lines: $lines) {
    cart {
      ...CartFields
    }
    userErrors {
      field
      message
      code
    }
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}`) as unknown as TypedDocumentString<CartLinesUpdateMutation, CartLinesUpdateMutationVariables>;
export const CartLinesRemoveDocument = new TypedDocumentString(`
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
    cart {
      ...CartFields
    }
    userErrors {
      field
      message
      code
    }
  }
}
    fragment MoneyFields on MoneyV2 {
  amount
  currencyCode
}
fragment CartFields on Cart {
  id
  checkoutUrl
  totalQuantity
  cost {
    subtotalAmount {
      ...MoneyFields
    }
  }
  lines(first: 50) {
    edges {
      node {
        id
        quantity
        merchandise {
          ... on ProductVariant {
            id
            title
            price {
              ...MoneyFields
            }
            image {
              url
              altText
              width
              height
            }
            product {
              title
              handle
            }
          }
        }
      }
    }
  }
}`) as unknown as TypedDocumentString<CartLinesRemoveMutation, CartLinesRemoveMutationVariables>;