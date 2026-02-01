/**
 * Address Utilities Module
 * Provides reusable functions for address parsing, validation, and auto-fill functionality
 */

/**
 * Load Iowa zip code data
 * @returns {Promise<Object>} Zip code data organized by county
 */
export async function loadZipCodeData() {
    try {
        const response = await fetch('iowa_zip_codes.json');
        if (!response.ok) {
            throw new Error('Failed to load zip code data');
        }
        return await response.json();
    } catch (error) {
        console.warn('Zip code data is not available:', error);
        return null;
    }
}

/**
 * Parse a full address string into components
 * Supports formats like:
 * - "123 Main St, Des Moines, IA 50301"
 * - "123 Main St, Des Moines IA 50301"
 * - "123 Main St, Des Moines, Iowa 50322-4931"
 * 
 * @param {string} addressString - Full address string
 * @returns {Object|null} Parsed address components or null if no zip found
 */
export function parseFullAddress(addressString) {
    if (!addressString || typeof addressString !== 'string') {
        return null;
    }

    // Check if value contains a zip code pattern (5 digits or 5+4 format)
    var zipMatch = addressString.match(/\b(\d{5}(?:-\d{4})?)\b/);
    
    if (!zipMatch) {
        return null;
    }

    var extractedZip = zipMatch[1];
    
    // Split by comma and trim whitespace
    var parts = addressString.split(',').map(function(p) { return p.trim(); });
    
    if (parts.length < 2) {
        return null;
    }

    var street = parts[0];
    var extractedState = '';
    var extractedCity = '';
    
    if (parts.length === 3) {
        // Format: "street, city, state zip"
        extractedCity = parts[1];
        var stateZip = parts[2];
        var stateMatch = stateZip.match(/\b([A-Z]{2}|Iowa|iowa)\b/i);
        if (stateMatch) {
            extractedState = stateMatch[1].toUpperCase();
            if (extractedState === 'IOWA') extractedState = 'IA';
        }
    } else {
        // Format: "street, city state zip" (only 2 parts)
        var lastPart = parts[parts.length - 1];
        
        // Extract zip from last part
        var zipInLast = lastPart.match(/\b(\d{5}(?:-\d{4})?)\b/);
        if (zipInLast) {
            // Remove zip from last part to get city/state
            var cityStatePart = lastPart.replace(zipInLast[0], '').trim();
            
            // Try to extract state (2-letter code or full name at end)
            var stateMatch2 = cityStatePart.match(/\b([A-Z]{2}|Iowa|iowa)\s*$/i);
            
            if (stateMatch2) {
                extractedState = stateMatch2[1].toUpperCase();
                if (extractedState === 'IOWA') extractedState = 'IA';
                extractedCity = cityStatePart.replace(stateMatch2[0], '').trim();
            } else {
                extractedCity = cityStatePart;
            }
        }
    }

    return {
        street: street,
        city: extractedCity,
        state: extractedState,
        zipCode: extractedZip
    };
}

/**
 * Get valid cities for a zip code
 * @param {string} zipCode - Zip code (can include +4)
 * @param {Object} zipCodeData - Zip code data from loadZipCodeData()
 * @returns {Array<string>} List of valid city names for this zip code
 */
export function getValidCitiesForZip(zipCode, zipCodeData) {
    if (!zipCode || !zipCodeData) {
        return [];
    }

    // Extract 5-digit portion (handle ZIP+4 format)
    var zipBase = zipCode.split('-')[0];
    var validCities = [];

    for (var county in zipCodeData) {
        if (zipCodeData.hasOwnProperty(county)) {
            var cityEntries = zipCodeData[county];
            if (Array.isArray(cityEntries)) {
                for (var i = 0; i < cityEntries.length; i++) {
                    var entry = cityEntries[i];
                    if (Array.isArray(entry.zips)) {
                        for (var j = 0; j < entry.zips.length; j++) {
                            if (entry.zips[j] === zipBase) {
                                validCities.push(entry.city);
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    return validCities;
}

/**
 * Get zip codes for a city
 * @param {string} cityName - City name
 * @param {Object} zipCodeData - Zip code data from loadZipCodeData()
 * @returns {Array<string>} List of zip codes for this city
 */
export function getZipCodesForCity(cityName, zipCodeData) {
    if (!cityName || !zipCodeData) {
        return [];
    }

    for (var county in zipCodeData) {
        if (zipCodeData.hasOwnProperty(county)) {
            var cityEntries = zipCodeData[county];
            if (Array.isArray(cityEntries)) {
                for (var i = 0; i < cityEntries.length; i++) {
                    if (cityEntries[i].city === cityName) {
                        return cityEntries[i].zips || [];
                    }
                }
            }
        }
    }

    return [];
}

/**
 * Validate and auto-correct city based on zip code
 * If the current city is not valid for the zip code, returns the first valid city
 * @param {string} zipCode - Zip code
 * @param {string} currentCity - Current city value
 * @param {Object} zipCodeData - Zip code data
 * @returns {Object} { city: string, changed: boolean, validCities: Array }
 */
export function validateCityForZip(zipCode, currentCity, zipCodeData) {
    var validCities = getValidCitiesForZip(zipCode, zipCodeData);
    
    if (validCities.length === 0) {
        return { city: currentCity, changed: false, validCities: [] };
    }

    // Check if current city is valid for this zip code
    var cityFound = false;
    for (var i = 0; i < validCities.length; i++) {
        if (validCities[i] === currentCity) {
            cityFound = true;
            break;
        }
    }

    if (cityFound) {
        return { city: currentCity, changed: false, validCities: validCities };
    }

    // Return first valid city if current is not valid
    return { city: validCities[0], changed: true, validCities: validCities };
}

/**
 * Setup automatic address field population and validation
 * Wires up event handlers for address parsing and zip code validation
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.streetFieldId - ID of street input field
 * @param {string} config.cityFieldId - ID of city input field
 * @param {string} config.stateFieldId - ID of state input field
 * @param {string} config.zipFieldId - ID of zip code input field
 * @param {Object} config.zipCodeData - Zip code data from loadZipCodeData()
 * @param {Function} config.onAddressChange - Optional callback when address changes
 * @returns {Object} Cleanup function to remove event listeners
 */
export function setupAddressAutofill(config) {
    var streetField = document.getElementById(config.streetFieldId);
    var cityField = document.getElementById(config.cityFieldId);
    var stateField = document.getElementById(config.stateFieldId);
    var zipField = document.getElementById(config.zipFieldId);
    var zipCodeData = config.zipCodeData;

    if (!streetField || !cityField || !stateField || !zipField) {
        console.error('One or more address fields not found');
        return { cleanup: function() {} };
    }

    // Handler for parsing full address pasted into street field
    var streetInputHandler = function() {
        var value = streetField.value;
        var parsed = parseFullAddress(value);

        if (parsed) {
            // Update fields - set city BEFORE zip so validation can check it
            streetField.value = parsed.street;
            if (parsed.city) cityField.value = parsed.city;
            if (parsed.state) stateField.value = parsed.state;
            zipField.value = parsed.zipCode;
            
            // Trigger zip field blur to auto-fill city/state from zip data if available
            setTimeout(function() {
                zipField.dispatchEvent(new Event('blur'));
            }, 0);

            if (config.onAddressChange) {
                config.onAddressChange(parsed);
            }
        }
    };

    // Handler for zip code validation
    var zipBlurHandler = function() {
        if (!zipCodeData) return;

        var zipCode = zipField.value;
        var currentCity = cityField.value;
        
        if (zipCode) {
            var result = validateCityForZip(zipCode, currentCity, zipCodeData);
            
            // Only change city if current value is not valid for this zip
            if (result.changed) {
                cityField.value = result.city;
            }
            
            // If zip code found in Iowa data, set state to IA
            if (result.validCities.length > 0) {
                stateField.value = 'IA';
            }

            if (config.onAddressChange) {
                config.onAddressChange({
                    street: streetField.value,
                    city: cityField.value,
                    state: stateField.value,
                    zipCode: zipCode
                });
            }
        }
    };

    // Handler for city validation (auto-fill zip if city has only one zip)
    var cityBlurHandler = function() {
        if (!zipCodeData) return;

        var city = cityField.value;
        if (city) {
            var zipCodes = getZipCodesForCity(city, zipCodeData);
            if (zipCodes.length === 1) {
                zipField.value = zipCodes[0];
                
                if (config.onAddressChange) {
                    config.onAddressChange({
                        street: streetField.value,
                        city: city,
                        state: stateField.value,
                        zipCode: zipCodes[0]
                    });
                }
            }
        }
    };

    // Attach event listeners
    streetField.addEventListener('input', streetInputHandler);
    zipField.addEventListener('blur', zipBlurHandler);
    cityField.addEventListener('blur', cityBlurHandler);

    // Return cleanup function
    return {
        cleanup: function() {
            streetField.removeEventListener('input', streetInputHandler);
            zipField.removeEventListener('blur', zipBlurHandler);
            cityField.removeEventListener('blur', cityBlurHandler);
        }
    };
}

/**
 * Format address object for display
 * @param {Object} address - Address object with street, city, state, zipCode
 * @param {boolean} multiLine - Whether to use line breaks (default: true)
 * @returns {string} Formatted address string
 */
export function formatAddressForDisplay(address, multiLine) {
    if (multiLine === undefined) multiLine = true;
    
    if (!address || !address.street) {
        return '';
    }

    var parts = [address.street];
    var cityStateZip = [];
    
    if (address.city) cityStateZip.push(address.city);
    if (address.state) {
        if (address.city) {
            cityStateZip[cityStateZip.length - 1] += ',';
        }
        cityStateZip.push(address.state);
    }
    if (address.zipCode) cityStateZip.push(address.zipCode);

    if (cityStateZip.length > 0) {
        parts.push(cityStateZip.join(' '));
    }

    return multiLine ? parts.join('<br>') : parts.join(', ');
}

/**
 * Format address for Google Maps URL
 * @param {Object} address - Address object with street, city, state, zipCode
 * @returns {string} Google Maps search URL
 */
export function formatAddressForMaps(address) {
    if (!address || !address.street) {
        return '';
    }

    var parts = [
        address.street,
        address.city,
        address.state,
        address.zipCode
    ].filter(function(p) { return p; });

    var query = encodeURIComponent(parts.join(', '));
    return 'https://www.google.com/maps/search/?api=1&query=' + query;
}

/**
 * Populate address fields from an address object
 * @param {string} fieldPrefix - Prefix for field IDs (e.g., 'address' for addressStreet)
 * @param {Object} address - Address object with street, city, state, zipCode
 */
export function populateAddressFields(fieldPrefix, address) {
    if (!address) return;

    var streetField = document.getElementById(fieldPrefix + 'Street');
    var cityField = document.getElementById(fieldPrefix + 'City');
    var stateField = document.getElementById(fieldPrefix + 'State');
    var zipField = document.getElementById(fieldPrefix + 'ZipCode');

    if (streetField) streetField.value = address.street || '';
    if (cityField) cityField.value = address.city || '';
    if (stateField) stateField.value = address.state || '';
    if (zipField) zipField.value = address.zipCode || '';
}

/**
 * Get address values from form fields
 * @param {string} fieldPrefix - Prefix for field IDs (e.g., 'address' for addressStreet)
 * @returns {Object} Address object with street, city, state, zipCode
 */
export function getAddressFromFields(fieldPrefix) {
    var streetField = document.getElementById(fieldPrefix + 'Street');
    var cityField = document.getElementById(fieldPrefix + 'City');
    var stateField = document.getElementById(fieldPrefix + 'State');
    var zipField = document.getElementById(fieldPrefix + 'ZipCode');

    return {
        street: streetField ? streetField.value : '',
        city: cityField ? cityField.value : '',
        state: stateField ? stateField.value : '',
        zipCode: zipField ? zipField.value : ''
    };
}
