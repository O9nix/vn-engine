const TestPluginB = {
    name: 'test-b',

    install(api) {
        const test =
            api.services.get('test');

        console.log(
            'Test service:',
            test?.hello()
        );
    }
};