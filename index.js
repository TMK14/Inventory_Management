const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { GetCommand, PutCommand, UpdateCommand, DeleteCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const dynamodb = new DynamoDBClient({ region: 'eu-north-1' });
const dynamodbTableName = 'product-inventory';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

exports.handler = async function(event) {
    console.log('Request Event: ', event);
    let response;
    switch (true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;
        case event.httpMethod === 'GET' && event.path === productPath:
            response = await getProduct(event.queryStringParameters.productid);
            break;
        case event.httpMethod === 'GET' && event.path === productsPath:
            response = await getProducts();
            break;
        case event.httpMethod === 'POST' && event.path === productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;
        case event.httpMethod === 'PATCH' && event.path === productPath:
            const requestBody = JSON.parse(event.body);
            response = await modifyProduct(requestBody.productid, requestBody.updateKey, requestBody.updateValue);
            break;
        case event.httpMethod === 'DELETE' && event.path === productPath:
            response = await deleteProduct(JSON.parse(event.body).productid);
            break;
        default:
            response = buildResponse(404, '404 Not Found');
    }
    return response;
};

async function getProduct(productId) {
    const params = {
        TableName: dynamodbTableName,
        Key: { 'productid': productId }
    };
    try {
        const data = await dynamodb.send(new GetCommand(params));
        return buildResponse(200, data.Item);
    } catch (error) {
        console.error('Error fetching product:', error);
        return buildResponse(500, { message: 'Internal Server Error', error: error.message });
    }
}

async function getProducts() {
    const params = { TableName: dynamodbTableName };
    try {
        const data = await dynamodb.send(new ScanCommand(params));
        const body = { products: data.Items };
        return buildResponse(200, body);
    } catch (error) {
        console.error('Error fetching products:', error);
        return buildResponse(500, { message: 'Internal Server Error', error: error.message });
    }
}

async function saveProduct(requestBody) {
    if (!requestBody.productid || typeof requestBody.productid !== 'string') {
        return buildResponse(400, { message: 'Invalid productid format' });
    }
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    };
    try {
        await dynamodb.send(new PutCommand(params));
        const body = {
            Operation: 'SAVE',
            Message: 'SUCCESS',
            Item: requestBody
        };
        return buildResponse(200, body);
    } catch (error) {
        console.error('Error saving product:', error);
        return buildResponse(500, { message: 'Internal Server Error', error: error.message });
    }
}

async function modifyProduct(productId, updateKey, updateValue) {
    const params = {
        TableName: dynamodbTableName,
        Key: { 'productid': productId },
        UpdateExpression: `set ${updateKey} = :value`,
        ExpressionAttributeValues: {
            ':value': updateValue
        },
        ReturnValues: 'UPDATED_NEW'
    };
    try {
        const data = await dynamodb.send(new UpdateCommand(params));
        const body = {
            Operation: 'UPDATE',
            Message: 'SUCCESS',
            UpdatedAttributes: data.Attributes
        };
        return buildResponse(200, body);
    } catch (error) {
        console.error('Error updating product:', error);
        return buildResponse(500, { message: 'Internal Server Error', error: error.message });
    }
}

async function deleteProduct(productId) {
    const params = {
        TableName: dynamodbTableName,
        Key: { 'productid': productId },
        ReturnValues: 'ALL_OLD'
    };
    try {
        const data = await dynamodb.send(new DeleteCommand(params));
        const body = {
            Operation: 'DELETE',
            Message: 'SUCCESS',
            Item: data.Attributes
        };
        return buildResponse(200, body);
    } catch (error) {
        console.error('Error deleting product:', error);
        return buildResponse(500, { message: 'Internal Server Error', error: error.message });
    }
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}
