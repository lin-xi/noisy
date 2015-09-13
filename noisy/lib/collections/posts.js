Posts = new Mongo.Collection('posts');

Meteor.methods({
    postInsert: function (data) {
        var post = {
            type: data.type,
            user: data.user,
            content: data.content,
            time: new Date()
        };

        var postId = Posts.insert(post);

        return {
            _id: postId
        };
    }
});