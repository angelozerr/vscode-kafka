import * as vscode from "vscode";

import { Cluster, Client, ClientAccessor } from "../../client";
import { NodeBase } from "./nodeBase";
import { BrokerGroupItem } from "./brokers";
import { TopicGroupItem, TopicItem } from "./topics";

import { ConsumerGroupsItem } from "./consumerGroups";
import { KafkaModel } from "./kafka";
import { Disposable } from "vscode";
import { GlyphChars, Icons } from "../../constants";

const TOPIC_INDEX = 1;

export class ClusterItem extends NodeBase implements Disposable {
    public contextValue = "cluster";
    public collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    public iconPath = Icons.ClusterDisconnected;

    constructor(private clientAccessor: ClientAccessor, public readonly cluster: Cluster, parent: KafkaModel) {
        super(parent);
        this.label = cluster.name;
        this.description = cluster.bootstrap;
    }

    public get client(): Client {
        return this.clientAccessor.get(this.cluster.id);
    }

    async getChildren(): Promise<NodeBase[]> {
        try {
            this.description = this.cluster.bootstrap;
            this.iconPath = Icons.ClusterConnecting;
            this.getParent().explorer.refreshItem(this);
           await this.client.connect();
           this.iconPath = Icons.ClusterConnected;
            this.getParent().explorer.refreshItem(this);
        }
        catch (e) {
            this.iconPath = Icons.ClusterError;
            this.description = e.message;
            //this.getParent().explorer.refreshItem(this);
            //return [new ErrorItem(e.message, this)];
            //throw e;
            return [];
        }
        if (!this.children) {
            this.children = await this.computeChildren();
        }
        return this.children;
    }

    async computeChildren(): Promise<NodeBase[]> {
        return [
            new BrokerGroupItem(this),
            new TopicGroupItem(this),
            new ConsumerGroupsItem(this)];
    }

    getParent(): KafkaModel {
        return <KafkaModel>super.getParent();
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = super.getTreeItem();
        // to prevent from tree expansion after a refresh, we need to force the id to a static value
        // because we change the label according if cluster is selected or not.
        treeItem.id = this.cluster.name;
        // update label and contextValue (used by contextual menu) according the selection state
        if (this.selected) {
            treeItem.contextValue = 'selectedCluster';
            treeItem.label = GlyphChars.Check + ' ' + treeItem.label;
        } else {
            treeItem.contextValue = 'cluster';
        }
        return treeItem;
    }

    public get selected(): boolean {
        return (this.getParent().clusterSettings.selected?.name === this.cluster.name);
    }

    public dispose(): void {
        this.client.dispose();
    }

    async findTopictemByName(topicName: string): Promise<NodeBase | TopicItem | undefined> {
        const topics = (await this.getTopicGroupItem()).getChildren();
        return topics
            .then(t =>
                t.find(child => (<TopicItem>child).topic.id === topicName));
    }

    private async getTopicGroupItem(): Promise<NodeBase> {
        return (await this.getChildren())[TOPIC_INDEX];
    }

}
