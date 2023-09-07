const path = require('path');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'development',
    devtool: 'cheap-module-source-map',
    entry: {
        background: './src/background.js',
        popup: ['./src/popup.js', './src/popup.css'],
        offscreen: './src/offscreen.js',
        devtoolsdetect: './src/devtoolsdetect.js',
        // Add other entry points as needed
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader']
            }
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'manifest.json', to: 'manifest.json' },
            ]
        }),
        new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css',
        }),
        new HtmlWebpackPlugin({
            template: './src/popup.html',
            filename: 'popup.html',
            chunks: ['popup']
        }),
        new HtmlWebpackPlugin({
            template: './src/offscreen.html',
            filename: 'offscreen.html',
            chunks: ['offscreen']
        }),
    ]
};
