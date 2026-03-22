-- Terrazzo PlaceIntelligence Description Audit Script
-- Identifies mismatches between placeType and description content
-- Also checks for contradictions with Google Places types

WITH place_keywords AS (
  SELECT
    id,
    "googlePlaceId",
    "propertyName",
    "placeType",
    description,
    -- Check for food/restaurant keywords in non-food place types
    CASE
      WHEN "placeType" IN ('shop', 'museum', 'activity', 'neighborhood')
        AND description ~* '(chef|prix-fixe|prix fixe|menu|cuisine|dishes|sommelier|tasting menu|wine list|reservation|courses|diner|restaurant|gastronomy)'
      THEN 'Non-food place with restaurant description keywords'
      ELSE NULL
    END AS food_keyword_mismatch,

    -- Check for non-food keywords in food place types
    CASE
      WHEN "placeType" IN ('restaurant', 'bar', 'cafe')
        AND description ~* '(shopping|retail|fashion|boutique|exhibits?|gallery|collection|rooms|check-in|check in|lobby|spa|pool|hotel|accommodation|sleeping|bedrooms?|suites?)'
      THEN 'Food place with non-food description keywords'
      ELSE NULL
    END AS non_food_keyword_mismatch,

    -- Check if googleData types contradict the description
    CASE
      WHEN "googleData" IS NOT NULL
        AND "googleData"::text ~* '"types"'
        AND "googleData"::text ~* 'clothing_store'
        AND description ~* '(chef|prix-fixe|prix fixe|menu|cuisine|sommelier|tasting menu|wine list|restaurant|gastronomy)'
      THEN 'Google says clothing_store but description is restaurant'
      WHEN "googleData" IS NOT NULL
        AND "googleData"::text ~* '"types"'
        AND "googleData"::text ~* 'restaurant'
        AND description ~* '(shopping|retail|fashion|boutique|collection)'
      THEN 'Google says restaurant but description is retail/fashion'
      ELSE NULL
    END AS google_type_contradiction
  FROM
    "PlaceIntelligence"
  WHERE
    status = 'complete'
    AND description IS NOT NULL
    AND description != ''
)
SELECT
  id,
  "googlePlaceId",
  "propertyName",
  "placeType",
  LEFT(description, 200) || CASE WHEN LENGTH(description) > 200 THEN '...' ELSE '' END AS description_preview,
  COALESCE(
    food_keyword_mismatch,
    non_food_keyword_mismatch,
    google_type_contradiction,
    'Unknown mismatch'
  ) AS mismatch_reason
FROM
  place_keywords
WHERE
  food_keyword_mismatch IS NOT NULL
  OR non_food_keyword_mismatch IS NOT NULL
  OR google_type_contradiction IS NOT NULL
ORDER BY
  "placeType" ASC,
  "propertyName" ASC;
